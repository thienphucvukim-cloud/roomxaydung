(() => {
  "use strict";

  const appVersion = 22;
  let activeSteelProfile = "";
  let profileRows = null;

  state.version = appVersion;
  state.settings = {
    density: 7850,
    decimals: 2,
    bg: "#080808",
    textHeight: 125,
    summaryByDiameter: true,
    ...state.settings,
  };
  state.schedules = Array.isArray(state.schedules) && state.schedules.length ? state.schedules : fresh().schedules;
  const normalizeComponents = (table) => {
    table.components = Array.isArray(table.components) ? table.components : [];
    const unique = [];
    const names = new Map();
    for (const part of table.components) {
      part.name = String(part.name || "Cấu kiện").trim() || "Cấu kiện";
      part.quantity = Math.max(1, Number(part.quantity) || 1);
      part.items = Array.isArray(part.items) ? part.items : [];
      const key = part.name.toLocaleLowerCase("vi");
      const existing = names.get(key);
      if (!existing) {
        names.set(key, part);
        unique.push(part);
        continue;
      }
      const knownIds = new Set(existing.items.map((item) => item.id));
      existing.items.push(...part.items.filter((item) => !knownIds.has(item.id)));
      existing.quantity = Math.max(existing.quantity, part.quantity);
    }
    table.components = unique;
  };
  for (const table of state.schedules) normalizeComponents(table);
  if (!state.schedules[0].components.length) {
    state.schedules[0].components.push({ id: uid(), name: "Dầm D1", quantity: 1, items: [] });
  }
  scheduleId = state.schedules.some((item) => item.id === scheduleId) ? scheduleId : state.schedules[0].id;
  componentId = schedule()?.components.some((item) => item.id === componentId)
    ? componentId
    : schedule()?.components[0]?.id || null;


  const originalText = tx;
  tx = (group, x, y, content, size = 14, fill = "#d4dd1e", anchor = "middle", rotation = 0) => {
    const ratio = Math.max(0.55, Math.min(1.8, Number(state.settings.textHeight || 125) / 125));
    return originalText(group, x, y, content, size * ratio, fill, anchor, rotation);
  };

  const originalReadItem = readItem;
  readItem = () => {
    const item = originalReadItem();
    if (selectedShape?.tab === 6) item.steelProfile = activeSteelProfile;
    return item;
  };

  const originalSelectItem = selectItem;
  selectItem = (id, component, table) => {
    if (!chooseMode) {
      show("Bấm Chọn hoặc phím C trước khi chọn thanh trên bản vẽ");
      return;
    }
    chooseMode = false;
    originalSelectItem(id, component, table);
    const item = window.currentRebarItem?.() || schedule()?.components
      .flatMap((part) => part.items)
      .find((bar) => bar.id === selectedId);
    activeSteelProfile = item?.steelProfile || "";
    $("chooseItem").classList.remove("active-command");
  };

  addSchedule = () => {
    const first = { id: uid(), name: "Dầm D1", quantity: 1, items: [] };
    const table = { id: uid(), name: `BTKT ${state.schedules.length + 1}`, components: [first] };
    state.schedules.push(table);
    scheduleId = table.id;
    componentId = first.id;
    selectedId = null;
    save();
    refresh();
  };

  openProject = async (file) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || !Array.isArray(parsed.schedules) || !parsed.schedules.length) throw new Error("schema");
      for (const table of parsed.schedules) {
        if (!table || !Array.isArray(table.components)) throw new Error("schema");
        for (const part of table.components) {
          if (!part || !Array.isArray(part.items)) throw new Error("schema");
        }
      }
      state = parsed;
      state.version = appVersion;
      state.settings = {
        density: 7850,
        decimals: 2,
        bg: "#080808",
        textHeight: 125,
        summaryByDiameter: true,
        ...state.settings,
      };
      for (const table of state.schedules) normalizeComponents(table);
      scheduleId = state.schedules[0].id;
      componentId = state.schedules[0].components[0]?.id || null;
      selectedId = null;
      chooseMode = false;
      save();
      refresh();
      fit();
      show("Đã mở hồ sơ thống kê");
    } catch {
      show("Tệp hồ sơ không hợp lệ");
    }
  };

  const clearSelection = () => {
    chooseMode = false;
    selectedId = null;
    $("editItem").disabled = true;
    $("deleteItem").disabled = true;
    $("chooseItem").classList.remove("active-command");
    render();
  };

  const dxfPair = (items, code, value) => {
    items.push(String(code), String(value));
  };

  const exportDxf = () => {
    render();
    const svg = $("cadSvg");
    const output = ["0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1021", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];
    const point = (element, x, y) => {
      const matrix = element.getCTM();
      const value = new DOMPoint(Number(x) || 0, Number(y) || 0).matrixTransform(matrix);
      return { x: value.x, y: -value.y };
    };
    const addLine = (a, b, layer = "KHUNG") => {
      dxfPair(output, 0, "LINE"); dxfPair(output, 8, layer);
      dxfPair(output, 10, a.x.toFixed(3)); dxfPair(output, 20, a.y.toFixed(3)); dxfPair(output, 30, 0);
      dxfPair(output, 11, b.x.toFixed(3)); dxfPair(output, 21, b.y.toFixed(3)); dxfPair(output, 31, 0);
    };
    svg.querySelectorAll("line").forEach((element) => addLine(
      point(element, element.getAttribute("x1"), element.getAttribute("y1")),
      point(element, element.getAttribute("x2"), element.getAttribute("y2")),
    ));
    svg.querySelectorAll("rect").forEach((element) => {
      if (element.classList.contains("hit") || element.classList.contains("selected")) return;
      const x = Number(element.getAttribute("x")) || 0;
      const y = Number(element.getAttribute("y")) || 0;
      const width = Number(element.getAttribute("width")) || 0;
      const height = Number(element.getAttribute("height")) || 0;
      if (!width || !height) return;
      const points = [point(element, x, y), point(element, x + width, y), point(element, x + width, y + height), point(element, x, y + height)];
      for (let index = 0; index < 4; index += 1) addLine(points[index], points[(index + 1) % 4]);
    });
    svg.querySelectorAll("text").forEach((element) => {
      const content = (element.textContent || "").trim();
      if (!content) return;
      const position = point(element, element.getAttribute("x"), element.getAttribute("y"));
      const matrix = element.getCTM();
      const rotation = -Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
      dxfPair(output, 0, "TEXT"); dxfPair(output, 8, "CHU");
      dxfPair(output, 10, position.x.toFixed(3)); dxfPair(output, 20, position.y.toFixed(3)); dxfPair(output, 30, 0);
      dxfPair(output, 40, Math.max(8, Number(element.getAttribute("font-size")) || 14));
      dxfPair(output, 1, content.replace(/[\r\n]+/g, " "));
      if (Math.abs(rotation) > 0.01) dxfPair(output, 50, rotation.toFixed(3));
    });
    output.push("0", "ENDSEC", "0", "EOF", "");
    download("bang-thong-ke-cot-thep.dxf", output.join("\r\n"), "application/dxf;charset=utf-8");
    show("Đã xuất DXF cho AutoCAD");
  };

  const exportSvg = () => {
    render();
    const clone = $("cadSvg").cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.querySelectorAll(".hit,.selected").forEach((element) => element.remove());
    const source = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
    download("bang-thong-ke-cot-thep.svg", source, "image/svg+xml;charset=utf-8");
    show("Đã xuất bản vẽ SVG");
  };

  const formatNumber = (value, digits = 0) => new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);

  const updateOverview = () => {
    const panel = document.querySelector(".lower > .blank");
    const table = schedule();
    if (!panel || !table) return;
    let barRows = 0;
    let totalBars = 0;
    let totalLength = 0;
    let totalWeight = 0;
    for (const part of table.components) {
      for (const item of part.items) {
        const result = calc(item, part.quantity);
        barRows += 1;
        totalBars += result.bars;
        totalLength += result.m;
        totalWeight += result.kg;
      }
    }
    const digits = Math.max(0, Math.min(5, Number(state.settings.decimals ?? 2)));
    panel.innerHTML = `
      <div class="overview-title">TỔNG QUAN · ${esc(table.name)}</div>
      <div class="overview-grid">
        <div class="overview-card">Cấu kiện<b>${formatNumber(table.components.length)}</b></div>
        <div class="overview-card">Dòng thép<b>${formatNumber(barRows)}</b></div>
        <div class="overview-card">Tổng số thanh<b>${formatNumber(totalBars)}</b></div>
        <div class="overview-card">Khối lượng<b>${formatNumber(totalWeight, digits)} kg</b></div>
      </div>
      <div class="overview-note">Tổng chiều dài: ${formatNumber(totalLength, digits)} m · Tự động cập nhật theo bảng hiện tại.</div>`;
  };

  const overviewObserver = new MutationObserver(updateOverview);
  overviewObserver.observe($("cadSvg"), { childList: true });
  const injectStyles = () => {
    const style = document.createElement("style");
    style.textContent = `
      .controls{overflow-x:auto}.controls>.tabs,.controls>.strip{min-width:1000px}.controls>.lower{min-width:1420px}
      .tool.active-command,.small.active-command{border-color:#1676be;background:#d9ecff;color:#07578f}
      .tool.wide-tool{width:auto;min-width:42px;padding:0 7px;font-weight:700}
      dialog.delta-dialog{width:min(760px,calc(100vw - 32px));max-height:min(680px,calc(100vh - 40px));border:1px solid #8b98a5;border-radius:8px;padding:0;box-shadow:0 20px 70px #0008;font:12px Tahoma,Arial,sans-serif}
      dialog.delta-dialog::backdrop{background:#10203088}.dialog-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#e9edf1;border-bottom:1px solid #aab3bc}.dialog-head h2{font-size:14px;margin:0}.dialog-close{width:28px;height:26px;border:1px solid #9ba7b2;background:#fff;cursor:pointer}.dialog-body{padding:12px;background:#f7f8fa}.profile-tools{display:grid;grid-template-columns:180px 1fr;gap:8px;margin-bottom:10px}.profile-tools select,.profile-tools input{height:30px;border:1px solid #aeb8c2;padding:3px 8px;background:white}.profile-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px;max-height:470px;overflow:auto}.profile-row{display:grid;grid-template-columns:1fr auto;gap:4px;text-align:left;border:1px solid #c2cad2;background:white;padding:8px;cursor:pointer}.profile-row:hover{border-color:#1676be;background:#edf7ff}.profile-row small{grid-column:1/-1;color:#66717c}.reorder-list{max-height:510px;overflow:auto}.reorder-part{margin-bottom:8px;border:1px solid #bcc6cf;background:white}.reorder-title,.reorder-bar{display:grid;grid-template-columns:1fr repeat(2,34px);align-items:center;gap:4px;padding:6px 8px}.reorder-title{background:#e8edf2;font-weight:700}.reorder-bar{margin-left:22px;border-top:1px solid #e0e5ea}.move-btn{height:25px;border:1px solid #aeb8c2;background:white;cursor:pointer}
      @media(max-width:700px){.top{overflow-x:auto}.brand{min-width:max-content}.viewport{min-height:45vh}.app{grid-template-rows:34px minmax(260px,1fr) auto 24px}.dialog-body{padding:8px}.profile-tools{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  };

  const createDialog = (id, title) => {
    const dialog = document.createElement("dialog");
    dialog.id = id;
    dialog.className = "delta-dialog";
    dialog.innerHTML = `<div class="dialog-head"><h2>${title}</h2><button type="button" class="dialog-close" aria-label="Đóng">×</button></div><div class="dialog-body"></div>`;
    dialog.querySelector(".dialog-close").onclick = () => dialog.close();
    dialog.onclick = (event) => { if (event.target === dialog) dialog.close(); };
    document.body.appendChild(dialog);
    return dialog;
  };

  const profileDialog = createDialog("profileDialog", "Bảng tra thông số thép hình DeltaTIP");
  const reorderDialog = createDialog("reorderDialog", "Bố trí lại cấu kiện và thanh thép");

  const loadProfiles = async () => {
    if (profileRows) return profileRows;
    const response = await fetch("./deltatip-profiles.json");
    if (!response.ok) throw new Error("profiles");
    profileRows = await response.json();
    return profileRows;
  };

  const showProfileDialog = async () => {
    const body = profileDialog.querySelector(".dialog-body");
    body.innerHTML = "Đang nạp bảng tra…";
    profileDialog.showModal();
    try {
      const rows = await loadProfiles();
      const categories = [...new Set(rows.map((item) => item.category))];
      body.innerHTML = `<div class="profile-tools"><select id="profileCategory"><option value="">Tất cả chủng loại</option>${categories.map((item) => `<option>${esc(item)}</option>`).join("")}</select><input id="profileSearch" placeholder="Tìm quy cách, ví dụ L50x5"></div><div class="profile-list" id="profileList"></div>`;
      const renderProfiles = () => {
        const category = $("profileCategory").value;
        const query = $("profileSearch").value.trim().toLocaleLowerCase("vi");
        const filtered = rows.filter((item) => (!category || item.category === category) && (!query || `${item.name} ${item.details}`.toLocaleLowerCase("vi").includes(query))).slice(0, 500);
        $("profileList").innerHTML = filtered.map((item) => `<button type="button" class="profile-row" data-index="${rows.indexOf(item)}"><b>${esc(item.name)}</b><strong>${item.kgm} kg/m</strong><small>${esc(item.category)} · ${esc(item.details || "Theo bảng DeltaTIP")}</small></button>`).join("") || "Không tìm thấy quy cách phù hợp.";
        $("profileList").querySelectorAll("button").forEach((button) => button.onclick = () => {
          const item = rows[Number(button.dataset.index)];
          activeSteelProfile = `${item.category} · ${item.name}`;
          $("steelWeight").value = item.kgm;
          profileDialog.close();
          show(`Đã chọn ${item.name} · ${item.kgm} kg/m`);
        });
      };
      $("profileCategory").onchange = renderProfiles;
      $("profileSearch").oninput = renderProfiles;
      renderProfiles();
    } catch {
      body.innerHTML = "Không nạp được bảng tra thép hình.";
    }
  };

  const move = (list, index, direction) => {
    const next = index + direction;
    if (index < 0 || next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
    save();
    refresh();
    renderReorder();
  };

  function renderReorder() {
    const table = schedule();
    const body = reorderDialog.querySelector(".dialog-body");
    body.innerHTML = `<div class="reorder-list">${table.components.map((part, partIndex) => `<section class="reorder-part"><div class="reorder-title"><span>${esc(part.name)} · SL ${part.quantity}</span><button class="move-btn" data-part="${partIndex}" data-dir="-1">↑</button><button class="move-btn" data-part="${partIndex}" data-dir="1">↓</button></div>${part.items.map((item, itemIndex) => `<div class="reorder-bar"><span>SH ${esc(item.mark)} · ${shapeMap.get(item.shapeId)?.name || item.shapeId}</span><button class="move-btn" data-part="${partIndex}" data-item="${itemIndex}" data-dir="-1">↑</button><button class="move-btn" data-part="${partIndex}" data-item="${itemIndex}" data-dir="1">↓</button></div>`).join("")}</section>`).join("")}</div>`;
    body.querySelectorAll("button").forEach((button) => button.onclick = () => {
      const partIndex = Number(button.dataset.part);
      const direction = Number(button.dataset.dir);
      if (button.dataset.item == null) move(table.components, partIndex, direction);
      else move(table.components[partIndex].items, Number(button.dataset.item), direction);
    });
  }

  const showReorderDialog = () => {
    renderReorder();
    reorderDialog.showModal();
  };

  const addToolbarButton = (id, label, title, handler, before) => {
    const button = document.createElement("button");
    button.type = "button";
    button.id = id;
    button.className = "tool wide-tool";
    button.textContent = label;
    button.title = title;
    button.onclick = handler;
    $("fitBtn").parentElement.insertBefore(button, before || $("fitBtn"));
    return button;
  };

  injectStyles();
  document.title = "Thống kê cốt thép DeltaTIP Web | ROOM XÂY DỰNG";
  document.querySelector(".brand").textContent = "DeltaTIP Web · Thống kê cốt thép";
  $("fileInput").accept = ".json,.rebar,.roomtip";
  $("excelBtn").title = "Xuất bảng Excel";
  addToolbarButton("dxfBtn", "DXF", "Xuất bản vẽ AutoCAD DXF", exportDxf);
  addToolbarButton("svgBtn", "SVG", "Xuất bản vẽ vector SVG", exportSvg);

  const wideButtons = document.querySelectorAll(".editor .wide");
  if (wideButtons[0]) wideButtons[0].onclick = showReorderDialog;
  if (wideButtons[1]) wideButtons[1].onclick = showProfileDialog;

  $("textHeight").value = state.settings.textHeight || 125;
  $("textHeight").onchange = () => {
    state.settings.textHeight = Math.max(50, Math.min(250, Number($("textHeight").value) || 125));
    $("textHeight").value = state.settings.textHeight;
    save(); render(); fit();
  };
  $("summaryCheck").checked = state.settings.summaryByDiameter !== false;
  $("summaryCheck").onchange = () => {
    state.settings.summaryByDiameter = $("summaryCheck").checked;
    save(); render(); fit();
  };
  $("addSchedule").onclick = addSchedule;
  $("chooseItem").onclick = () => {
    chooseMode = true;
    $("chooseItem").classList.add("active-command");
    show("Chọn một thanh trên bản vẽ (Esc để hủy)");
  };
  $("fileInput").onchange = async (event) => {
    if (event.target.files[0]) await openProject(event.target.files[0]);
    event.target.value = "";
  };
  $("newBtn").onclick = () => {
    if (!confirm("Tạo hồ sơ thống kê mới? Dữ liệu hiện tại vẫn có thể tải xuống trước khi tiếp tục.")) return;
    state = fresh();
    scheduleId = state.schedules[0].id;
    componentId = state.schedules[0].components[0].id;
    selectedId = null;
    activeSteelProfile = "";
    save(); refresh(); fit();
  };

  document.addEventListener("keydown", (event) => {
    const editing = ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); exportProject(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") { event.preventDefault(); $("fileInput").click(); return; }
    if (event.key === "Escape") { clearSelection(); profileDialog.close(); reorderDialog.close(); return; }
    if (editing || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "t") addItem();
    if (key === "c") $("chooseItem").click();
    if (key === "s" && selectedId) editItem();
    if (key === "x" && selectedId) deleteItem();
  });

  window.currentRebarItem = () => schedule()?.components.flatMap((part) => part.items).find((item) => item.id === selectedId);
  window.addEventListener("beforeunload", save);
  save();
  refresh();
  setTimeout(fit, 80);
})();
