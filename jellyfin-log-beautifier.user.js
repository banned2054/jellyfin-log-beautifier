// ==UserScript==
// @name         Jellyfin 日志美化 + 双筛选菜单（含模块排序和行数）
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  美化 Jellyfin 日志并支持“等级+模块”双筛选，模块名按字母排序并附带行数
// @match        http://127.0.0.1:8096/System/Logs/Log?name=log_*
// @icon         https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRzrq2XhIw7in73q4tTa6PTaQRO6KxAJ_XLZwgrZ7i8pkYdoJBk2NMUMBuqal72A0YyAbo&usqp=CAU
// @author       banned
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const logSelector = 'pre, code, .log, .terminal, body';
    const container = document.querySelector(logSelector);
    if (!container) return;

    const logText = container.innerText;
    const lines = logText.trim().split('\n');

    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    table.style.fontFamily = 'monospace';
    table.style.fontSize = '14px';

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th style="border:1px solid #ccc;padding:4px;width:120px">时间</th>
            <th style="border:1px solid #ccc;padding:4px;width:90px">等级</th>
            <th style="border:1px solid #ccc;padding:4px;width:25%">模块</th>
            <th style="border:1px solid #ccc;padding:4px">讯息</th>
        </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    const levelMap = {
        '[INF]': {text: '信息', color: '#2c7'},
        '[WRN]': {text: '警告', color: '#fa0'},
        '[ERR]': {text: '错误', color: '#e44'},
        '[DBG]': {text: '调试', color: '#0cf'},
        '[TRC]': {text: '追踪', color: '#ccc'},
        '[FTL]': {text: '严重', color: '#f55'},
        'UNKNOWN': {text: '无', color: '#999'}
    };

    const rows = [];
    const levelSet = new Set();
    const moduleMap = new Map(); // 模块名 -> 计数

    for (const line of lines) {
        const match = line.match(/^\[(.*?)\] \[(\w+)\] \[\d+\] (.*)$/);
        if (!match) continue;

        const [_, datetime, levelTag, fullMsg] = match;

        const dateStr = datetime.slice(0, 10);
        const timeStr = datetime.slice(11, 19);

        const levelKey = `[${levelTag}]`;
        const levelInfo = levelMap[levelKey] || levelMap['UNKNOWN'];
        const levelText = levelInfo.text;
        levelSet.add(levelText);

        let module = fullMsg;
        let message = '';
        const colonIndex = fullMsg.indexOf(':');
        if (colonIndex !== -1) {
            module = fullMsg.slice(0, colonIndex).trim();
            message = fullMsg.slice(colonIndex + 1).trim();
        }

        moduleMap.set(module, (moduleMap.get(module) || 0) + 1);

        const row = document.createElement('tr');
        row.dataset.level = levelText;
        row.dataset.module = module;

        row.innerHTML = `
            <td style="border:1px solid #ccc;padding:4px;text-align:center;">
                <div>${dateStr}</div><div>${timeStr}</div>
            </td>
            <td style="border:1px solid #ccc;padding:4px;text-align:center;color:${levelInfo.color};font-weight:bold;">
                ${levelText}
            </td>
            <td style="border:1px solid #ccc;padding:4px;word-break:break-word;">${module}</td>
            <td style="border:1px solid #ccc;padding:4px;white-space:pre-wrap;">${message}</td>
        `;

        rows.push(row);
    }

    function createFilterPanel(title, values, dataKey) {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.style.marginRight = '20px';

        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = `筛选 ${title}`;
        toggleBtn.style.padding = '6px 12px';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.style.marginBottom = '6px';

        const dropdown = document.createElement('div');
        dropdown.style.display = 'none';
        dropdown.style.position = 'absolute';
        dropdown.style.top = '100%';
        dropdown.style.left = '0';
        dropdown.style.backgroundColor = '#333';
        dropdown.style.border = '1px solid #555';
        dropdown.style.padding = '10px';
        dropdown.style.zIndex = '999';
        dropdown.style.color = '#fff';
        dropdown.style.borderRadius = '6px';
        dropdown.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        dropdown.style.maxHeight = '250px';
        dropdown.style.overflowY = 'auto';

        const checkboxes = [];
        let sortedList = [];

        if (dataKey === 'module') {
            sortedList = [...values.entries()]
                .sort((a, b) => a[0].localeCompare(b[0], 'en'))  // 排序
                .map(([key, count]) => ({label: key, count}));
        } else {
            sortedList = [...values].sort().map(key => ({label: key}));
        }

        // 动态测宽度
        const longest = sortedList.reduce((a, b) =>
                (a.label + (b.count ? ` (${b.count})` : '')).length > (b.label + (b.count ? ` (${b.count})` : '')).length ? a : b
            , {label: ''});
        const tmpSpan = document.createElement('span');
        tmpSpan.style.position = 'absolute';
        tmpSpan.style.visibility = 'hidden';
        tmpSpan.style.fontFamily = 'monospace';
        tmpSpan.textContent = longest.label + ' (999)';
        document.body.appendChild(tmpSpan);
        dropdown.style.minWidth = tmpSpan.offsetWidth + 30 + 'px';
        tmpSpan.remove();

        sortedList.forEach(({label, count}) => {
            const labelEl = document.createElement('label');
            labelEl.style.display = 'block';
            labelEl.style.margin = '4px 0';
            labelEl.style.cursor = 'pointer';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            checkbox.value = label;
            checkbox.style.marginRight = '8px';

            checkboxes.push(checkbox);

            const text = count ? `${label} (${count})` : label;
            labelEl.appendChild(checkbox);
            labelEl.appendChild(document.createTextNode(text));
            dropdown.appendChild(labelEl);
        });

        toggleBtn.onclick = () => {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        };

        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) dropdown.style.display = 'none';
        });

        wrapper.appendChild(toggleBtn);
        wrapper.appendChild(dropdown);

        return {wrapper, checkboxes, dataKey};
    }

    const levelPanel = createFilterPanel('等级', levelSet, 'level');
    const modulePanel = createFilterPanel('模块', moduleMap, 'module');

    function filterRows() {
        const selectedLevels = new Set(levelPanel.checkboxes.filter(c => c.checked).map(c => c.value));
        const selectedModules = new Set(modulePanel.checkboxes.filter(c => c.checked).map(c => c.value));

        tbody.innerHTML = '';
        for (const row of rows) {
            if (selectedLevels.has(row.dataset.level) && selectedModules.has(row.dataset.module)) {
                tbody.appendChild(row);
            }
        }
    }

    levelPanel.checkboxes.forEach(cb => cb.addEventListener('change', filterRows));
    modulePanel.checkboxes.forEach(cb => cb.addEventListener('change', filterRows));

    const controls = document.createElement('div');
    controls.style.marginBottom = '1em';
    controls.appendChild(levelPanel.wrapper);
    controls.appendChild(modulePanel.wrapper);

    container.innerHTML = '';
    container.appendChild(controls);
    container.appendChild(table);

    filterRows();
})();
