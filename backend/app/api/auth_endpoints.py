"""
DataPulse Assistant 认证与用户个人资源中心路由端点
处理注册登录、个人历史会话树检索与恢复、个人落盘研报管理与游客数据一键同步
"""
import json
import uuid
import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import get_db, User, ChatSession, ChatMessage, UserReport, hash_password, verify_password
from app.core.auth import create_access_token, get_current_user, get_optional_current_user

router = APIRouter(prefix="", tags=["Auth & User Workspace"])


# -------------------------------------------------------------
# 请求/响应 Schema
# -------------------------------------------------------------
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=32, description="用户名 (字母数字下划线)")
    password: str = Field(..., min_length=6, max_length=64, description="用户登录密码")
    nickname: Optional[str] = Field(None, max_length=32, description="用户昵称")


class LoginRequest(BaseModel):
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class SessionCreateRequest(BaseModel):
    title: str = Field(..., description="会话标题")
    datasource_name: Optional[str] = "sales_demo.sqlite"
    datasource_url: Optional[str] = None


class SyncGuestDataRequest(BaseModel):
    sessions: List[dict] = Field(default_factory=list, description="游客暂存的历史会话列表")
    reports: List[dict] = Field(default_factory=list, description="游客暂存的落盘文档列表")


# -------------------------------------------------------------
# 1. 认证相关端点
# -------------------------------------------------------------
@router.post("/auth/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """用户注册：创建新账号并直接签发登录 Token"""
    clean_username = req.username.strip().lower()
    existing_user = db.query(User).filter(User.username == clean_username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"用户名 '{clean_username}' 已被注册，请更换或直接登录"
        )
    
    new_user = User(
        username=clean_username,
        password_hash=hash_password(req.password),
        nickname=req.nickname.strip() if req.nickname else clean_username,
        role="analyst"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(data={"sub": new_user.username, "uid": new_user.id, "role": new_user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "username": new_user.username,
            "nickname": new_user.nickname,
            "role": new_user.role,
            "created_at": new_user.created_at.strftime("%Y-%m-%d %H:%M:%S")
        }
    }


@router.post("/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """用户登录：校验账号密码并返回 JWT Token"""
    clean_username = req.username.strip().lower()
    user = db.query(User).filter(User.username == clean_username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误，请检查后重试"
        )

    token = create_access_token(data={"sub": user.username, "uid": user.id, "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "nickname": user.nickname,
            "role": user.role,
            "created_at": user.created_at.strftime("%Y-%m-%d %H:%M:%S")
        }
    }


@router.get("/auth/me")
def get_me(user: User = Depends(get_current_user)):
    """获取当前登录用户信息"""
    return {
        "id": user.id,
        "username": user.username,
        "nickname": user.nickname,
        "role": user.role,
        "created_at": user.created_at.strftime("%Y-%m-%d %H:%M:%S")
    }


# -------------------------------------------------------------
# 2. 个人历史会话管理
# -------------------------------------------------------------
@router.get("/user/sessions")
def list_user_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取当前登录用户的所有历史对话会话列表"""
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    result = []
    for s in sessions:
        msg_count = len(s.messages)
        last_prompt = s.messages[-1].prompt if s.messages else s.title
        result.append({
            "id": s.id,
            "title": s.title,
            "datasource_name": s.datasource_name,
            "message_count": msg_count,
            "last_prompt": last_prompt,
            "updated_at": s.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })
    return {"sessions": result}


@router.post("/user/sessions")
def create_user_session(req: SessionCreateRequest, user: Optional[User] = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    """创建新会话 (支持已登录用户和游客)"""
    new_session = ChatSession(
        id=str(uuid.uuid4()),
        user_id=user.id if user else None,
        title=req.title,
        datasource_name=req.datasource_name or "sales_demo.sqlite",
        datasource_url=req.datasource_url
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return {
        "id": new_session.id,
        "title": new_session.title,
        "datasource_name": new_session.datasource_name,
        "created_at": new_session.created_at.strftime("%Y-%m-%d %H:%M:%S")
    }


@router.get("/user/sessions/{session_id}")
def get_session_detail(session_id: str, user: Optional[User] = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    """获取特定会话的完整研报消息流，用于在前端画布一键恢复历史分析"""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在或已删除")
    
    # 权限校验：如果会话属于某用户，且当前非该用户访问
    if session.user_id and (not user or user.id != session.user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问此私有会话")

    messages = []
    for m in session.messages:
        report_data = None
        if m.report_data_json:
            try:
                report_data = json.loads(m.report_data_json)
            except Exception:
                pass
        messages.append({
            "id": m.id,
            "role": m.role,
            "prompt": m.prompt,
            "safe_sql": m.safe_sql,
            "report_data": report_data,
            "created_at": m.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })

    return {
        "id": session.id,
        "title": session.title,
        "datasource_name": session.datasource_name,
        "datasource_url": session.datasource_url,
        "messages": messages,
        "updated_at": session.updated_at.strftime("%Y-%m-%d %H:%M:%S")
    }


@router.delete("/user/sessions/{session_id}")
def delete_user_session(session_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """删除指定的历史会话"""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在")
    if session.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权删除该会话")
    
    db.delete(session)
    db.commit()
    return {"success": True, "message": "会话已成功删除"}


# -------------------------------------------------------------
# 3. 个人落盘研报管理
# -------------------------------------------------------------
@router.get("/user/reports")
def list_user_reports(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取当前登录用户已确认落盘的研报列表"""
    reports = (
        db.query(UserReport)
        .filter(UserReport.user_id == user.id)
        .order_by(UserReport.created_at.desc())
        .all()
    )
    result = []
    for r in reports:
        result.append({
            "id": r.id,
            "file_name": r.file_name,
            "title": r.title,
            "summary": r.summary,
            "size_bytes": r.size_bytes,
            "download_url": f"/api/v1/reports/download/{r.file_name}",
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })
    return {"reports": result}


# -------------------------------------------------------------
# 4. 游客数据一键同步至登录账号 (Zero-Friction Sync)
# -------------------------------------------------------------
@router.post("/user/sync")
def sync_guest_data(req: SyncGuestDataRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """将游客在浏览器本地暂存的对话与研报同步绑定到新登录的账号"""
    synced_sessions_count = 0
    synced_reports_count = 0

    # 1. 同步会话
    for s_data in req.sessions:
        s_id = s_data.get("id") or str(uuid.uuid4())
        # 避免重复
        existing = db.query(ChatSession).filter(ChatSession.id == s_id).first()
        if existing:
            if not existing.user_id:
                existing.user_id = user.id
                synced_sessions_count += 1
            continue
        
        session = ChatSession(
            id=s_id,
            user_id=user.id,
            title=s_data.get("title", "未命名会话"),
            datasource_name=s_data.get("datasource_name", "sales_demo.sqlite"),
            datasource_url=s_data.get("datasource_url")
        )
        db.add(session)
        # 附带同步消息
        for m_data in s_data.get("messages", []):
            msg = ChatMessage(
                session_id=s_id,
                role=m_data.get("role", "assistant"),
                prompt=m_data.get("prompt"),
                safe_sql=m_data.get("safe_sql"),
                report_data_json=json.dumps(m_data.get("report_data")) if m_data.get("report_data") else None
            )
            db.add(msg)
        synced_sessions_count += 1

    # 2. 同步落盘研报
    for r_data in req.reports:
        f_name = r_data.get("file_name")
        if not f_name:
            continue
        existing_report = db.query(UserReport).filter(UserReport.file_name == f_name, UserReport.user_id == user.id).first()
        if not existing_report:
            new_report = UserReport(
                user_id=user.id,
                session_id=r_data.get("session_id"),
                file_name=f_name,
                title=r_data.get("title", f_name),
                summary=r_data.get("summary"),
                size_bytes=r_data.get("size_bytes", 0)
            )
            db.add(new_report)
            synced_reports_count += 1

    db.commit()
    return {
        "success": True,
        "message": f"同步完成: 已绑定 {synced_sessions_count} 个历史会话与 {synced_reports_count} 篇落盘研报",
        "synced_sessions_count": synced_sessions_count,
        "synced_reports_count": synced_reports_count
    }
