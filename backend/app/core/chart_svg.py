"""
DataPulse Assistant 纯轻量矢量 SVG 图表渲染引擎
在不依赖任何重型第三方库 (如 matplotlib/cairo) 的前提下，纯原生生成现代极客风 SVG 业务趋势图表
可无缝内嵌至 Markdown 物理落盘研报中，让研报具备原生离线可视化能力
"""
from typing import List, Any, Dict, Optional
import html


def generate_chart_svg(
    columns: List[str],
    rows: List[List[Any]],
    chart_meta: Optional[Dict[str, Any]] = None,
    width: int = 760,
    height: int = 240
) -> str:
    """
    根据查询结果与语义元数据生成高颜值矢量 SVG 面积趋势图
    """
    if not columns or not rows:
        return ""

    x_idx = chart_meta.get("x_index", 0) if chart_meta else 0
    y_idx = chart_meta.get("y_index", 1 if len(columns) > 1 else 0) if chart_meta else 1

    # 兜底确保索引合法
    x_idx = max(0, min(x_idx, len(columns) - 1))
    y_idx = max(0, min(y_idx, len(columns) - 1))

    # 抽取并清洗数据
    data_points = []
    for i, r in enumerate(rows[:15]):  # 最多取前 15 组样本，保证图表美观不拥挤
        # X 轴标签
        raw_x = r[x_idx]
        x_label = str(raw_x) if raw_x is not None else f"样本 {i+1}"
        if len(x_label) > 12:
            x_label = x_label[:10] + ".."

        # Y 轴数值
        raw_y = r[y_idx]
        y_val = 0.0
        if raw_y is not None:
            clean_y = str(raw_y).replace(',', '').replace('¥', '').replace('$', '').replace('%', '').strip()
            try:
                y_val = float(clean_y)
            except ValueError:
                y_val = 0.0

        data_points.append({"label": x_label, "val": y_val})

    if not data_points:
        return ""

    max_val = max(d["val"] for d in data_points)
    min_val = min(d["val"] for d in data_points)
    if max_val == min_val:
        max_val = max_val + 1.0 if max_val > 0 else 1.0
        min_val = 0.0

    padding_left = 70
    padding_right = 40
    padding_top = 35
    padding_bottom = 45

    inner_w = width - padding_left - padding_right
    inner_h = height - padding_top - padding_bottom

    step_x = inner_w / max(len(data_points) - 1, 1)

    points = []
    for idx, d in enumerate(data_points):
        px = padding_left + idx * step_x
        # 归一化 Y
        ratio = (d["val"] - min_val) / (max_val - min_val) if max_val != min_val else 0.5
        py = padding_top + inner_h - ratio * inner_h
        points.append({"x": px, "y": py, "val": d["val"], "label": d["label"]})

    # 构建平滑曲线贝塞尔路径
    path_d = f"M {points[0]['x']:.1f} {points[0]['y']:.1f}"
    for i in range(len(points) - 1):
        p0 = points[i]
        p1 = points[i + 1]
        cpx = (p0["x"] + p1["x"]) / 2
        path_d += f" C {cpx:.1f} {p0['y']:.1f}, {cpx:.1f} {p1['y']:.1f}, {p1['x']:.1f} {p1['y']:.1f}"

    baseline_y = padding_top + inner_h
    area_d = f"{path_d} L {points[-1]['x']:.1f} {baseline_y:.1f} L {points[0]['x']:.1f} {baseline_y:.1f} Z"

    y_col_name = html.escape(columns[y_idx] if y_idx < len(columns) else "指标数值")
    x_col_name = html.escape(columns[x_idx] if x_idx < len(columns) else "维度")

    # 格式化数值展示
    def fmt_num(v: float) -> str:
        if v >= 100000000:
            return f"{v/100000000:.1f}亿"
        if v >= 10000:
            return f"{v/10000:.1f}w"
        if v >= 1000:
            return f"{v/1000:.1f}k"
        return f"{v:,.0f}"

    # 坐标轴网格线
    grid_lines = []
    for g_idx in range(4):
        gy = padding_top + (inner_h / 3) * g_idx
        g_val = max_val - (max_val - min_val) * (g_idx / 3)
        grid_lines.append(f"""
        <line x1="{padding_left}" y1="{gy:.1f}" x2="{width - padding_right}" y2="{gy:.1f}" stroke="#F0F0EE" stroke-width="1" stroke-dasharray="3,3" />
        <text x="{padding_left - 10}" y="{gy + 4:.1f}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="10" fill="#999994" text-anchor="end">{fmt_num(g_val)}</text>
        """)

    # 数据点圆圈与 X 轴标签
    nodes = []
    for p in points:
        nodes.append(f"""
        <circle cx="{p['x']:.1f}" cy="{p['y']:.1f}" r="4" fill="#FFFFFF" stroke="#2563EB" stroke-width="2.5" />
        <text x="{p['x']:.1f}" y="{p['y'] - 8:.1f}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="9" font-weight="600" fill="#1D4ED8" text-anchor="middle">{fmt_num(p['val'])}</text>
        <text x="{p['x']:.1f}" y="{baseline_y + 16:.1f}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="10" fill="#787873" text-anchor="middle">{html.escape(p['label'])}</text>
        """)

    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="auto" style="background:#FFFFFF;border-radius:14px;border:1px solid #EAEAE7;margin:16px 0;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
  <defs>
    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.28" />
      <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.0" />
    </linearGradient>
  </defs>

  <!-- 图表标题与图例 -->
  <text x="{padding_left}" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="12" font-weight="700" fill="#171717">趋势走势与业务量化对比 · 指标: {y_col_name}</text>
  <text x="{width - padding_right}" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="10" fill="#999994" text-anchor="end">X 轴基准: {x_col_name}</text>

  <!-- 网格刻度线 -->
  {''.join(grid_lines)}

  <!-- X 轴底线 -->
  <line x1="{padding_left}" y1="{baseline_y}" x2="{width - padding_right}" y2="{baseline_y}" stroke="#E5E5E3" stroke-width="1.5" />

  <!-- 面积阴影与贝塞尔主折线 -->
  <path d="{area_d}" fill="url(#areaGradient)" />
  <path d="{path_d}" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

  <!-- 数据点与标签 -->
  {''.join(nodes)}
</svg>"""

    return svg_content
