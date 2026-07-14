(function () {
  var React = window.QwenPaw.host.React;
  var antd = window.QwenPaw.host.antd;
  var pluginId = "agent-avatar";
  var STORAGE_KEY = "agent-avatar-config";
  var ASSETS_BASE = "/api/frontend_plugin/" + pluginId + "/files/assets/avatars/";

  console.log("[AgentAvatar] v3.1.1");

  var avatarCache = {};
  var agentNameCache = {};

  function loadAll() {
    try { avatarCache = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (e) { avatarCache = {}; }
    try { agentNameCache = JSON.parse(localStorage.getItem("agent-avatar-agents") || "{}"); } catch (e) { agentNameCache = {}; }
  }

  function saveAvatars() { localStorage.setItem(STORAGE_KEY, JSON.stringify(avatarCache)); }
  function saveNames() { localStorage.setItem("agent-avatar-agents", JSON.stringify(agentNameCache)); }

  loadAll();

  function getFilePath(agentId) { return ASSETS_BASE + agentId + ".png"; }

  function getAvatarUrl(id) {
    var e = avatarCache[id];
    if (e) {
      if (e.type === "file-path") return getFilePath(id);
      if (e.type === "local-file") return e.data;
      return e.url || null;
    }
    return getFilePath(id);
  }

  function applyAvatar() {
    var id = window.QwenPaw.host.getSelectedAgentId();
    if (!id) return;
    var url = getAvatarUrl(id);
    var nick = agentNameCache[id] || id;
    window.QwenPaw.chat.welcome.set(pluginId, { avatar: url || undefined, nick: nick });
    var logo = url ? React.createElement("img", { src: url, style: { height: 22, width: 22, borderRadius: "50%", objectFit: "cover" } }) : undefined;
    window.QwenPaw.chat.leftHeader.set(pluginId, { title: nick, logo: logo });
  }

  function AvatarWatcher() {
    var agent = window.QwenPaw.host.useSelectedAgent();
    React.useEffect(function () { loadAll(); applyAvatar(); }, [agent ? agent.id : null]);
    return null;
  }
  window.QwenPaw.slot.fill(pluginId, "content.statusBar", function () {
    return React.createElement(AvatarWatcher);
  });

  async function fetchAgents() {
    var result = [];
    try {
      var r = await window.QwenPaw.host.fetch("/agents");
      if (r.ok) {
        var d = await r.json();
        for (var i = 0; i < d.agents.length; i++) {
          var a = d.agents[i];
          if (a.id && a.name) { result.push(a); agentNameCache[a.id] = a.name; }
        }
      }
    } catch (e) {
      console.warn("[AgentAvatar] agents:", e.message || e);
    }
    saveNames();
    return result;
  }

  function AvatarSettingsPage() {
    var agState = React.useState([]), agents = agState[0], setAgents = agState[1];
    var pcfgState = React.useState({}), pageCfg = pcfgState[0], setPageCfg = pcfgState[1];
    var ldState = React.useState(true), loading = ldState[0], setLoading = ldState[1];
    var errState = React.useState(null), error = errState[0], setError = errState[1];
    var svState = React.useState(null), savingId = svState[0], setSavingId = svState[1];
    var inState = React.useState({}), urlIn = inState[0], setUrlIn = inState[1];

    var loadData = React.useCallback(async function () {
      setLoading(true);
      setError(null);
      var d = await fetchAgents();
      if (d.length > 0) setAgents(d);
      else setError("无法加载 Agent 列表");
      loadAll();
      setPageCfg(avatarCache);
      setLoading(false);
    }, []);

    React.useEffect(function () { loadData(); }, [loadData]);

    var onSetUrl = React.useCallback(async function (id) {
      var u = (urlIn[id] || "").trim();
      if (!u) return;
      setSavingId(id);
      avatarCache[id] = { type: "url", url: u, updatedAt: Date.now() };
      saveAvatars();
      setUrlIn(function (p) { var n = {}; for (var k in p) n[k] = p[k]; n[id] = ""; return n; });
      await loadData();
      setSavingId(null);
    }, [urlIn, loadData]);

    var onUpload = React.useCallback(async function (id, file, ok) {
      if (!file) return;
      setSavingId(id);
      var du = await new Promise(function (res, rej) {
        var r = new FileReader();
        r.onload = function () { res(r.result); };
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      avatarCache[id] = { type: "local-file", data: du, filename: file.name, updatedAt: Date.now() };
      saveAvatars();
      if (ok) ok();
      await loadData();
      setSavingId(null);
    }, [loadData]);

    var onUseFile = React.useCallback(async function (id) {
      setSavingId(id);
      avatarCache[id] = { type: "file-path", updatedAt: Date.now() };
      saveAvatars();
      await loadData();
      setSavingId(null);
    }, [loadData]);

    var onClear = React.useCallback(async function (id) {
      setSavingId(id);
      delete avatarCache[id];
      saveAvatars();
      await loadData();
      setSavingId(null);
    }, [loadData]);

    if (loading) {
      return React.createElement(antd.Spin, { style: { display: "block", margin: "80px auto" }, size: "large" });
    }

    if (error) {
      return React.createElement("div", { style: { padding: 24, maxWidth: 800, margin: "0 auto" } },
        React.createElement(antd.Alert, {
          type: "error", message: "加载失败", description: error, showIcon: true,
          action: React.createElement(antd.Button, { onClick: loadData, size: "small" }, "重试")
        })
      );
    }

    var cards = [];
    for (var i = 0; i < agents.length; i++) {
      (function (agent) {
        var avUrl = function () {
          var e = pageCfg[agent.id];
          if (e) {
            if (e.type === "file-path") return getFilePath(agent.id);
            if (e.type === "local-file") return e.data;
            if (e.url) return e.url;
          }
          return getFilePath(agent.id);
        }();
        var sv = savingId === agent.id;
        var hasFile = function () {
          var e = avatarCache[agent.id];
          return e && e.type === "file-path";
        }();
        var hasLocal = function () {
          var e = avatarCache[agent.id];
          return e && e.type === "local-file";
        }();
        var hasUrl = function () {
          var e = avatarCache[agent.id];
          return e && e.type === "url";
        }();

        var avatarEl = avUrl
          ? React.createElement("img", { src: avUrl, style: { width: "100%", height: "100%", objectFit: "cover" }, alt: agent.id })
          : React.createElement("span", { style: { fontSize: 20, color: "#bbb", fontWeight: "bold" } }, (agent.name || "?").charAt(0).toUpperCase());

        var avatarBox = React.createElement("div", {
          style: {
            width: 56, height: 56, borderRadius: "50%", overflow: "hidden",
            flexShrink: 0, background: "#f0f0f0",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #e8e8e8"
          }
        }, avatarEl);

        var nameEl = React.createElement("div", { style: { fontWeight: 600, fontSize: 15, marginBottom: 2 } }, agent.name || agent.id);
        var descEl = React.createElement("div", { style: { fontSize: 12, color: "#999", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, agent.description || agent.id);

        var fileRow = React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 } },
          React.createElement("span", { style: { fontSize: 12, color: "#888", whiteSpace: "nowrap" } }, "📁 文件方式：" + (hasFile ? "✅ 已启用" : "未启用")),
          React.createElement("span", { style: { flex: 1, fontSize: 11, color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, hasFile ? "" : "图片存至 " + getFilePath(agent.id)),
          !hasFile ? React.createElement(antd.Button, { size: "small", type: "dashed", onClick: function () { onUseFile(agent.id); }, loading: sv, disabled: sv }, "启用文件路径") : null,
          hasFile ? React.createElement(antd.Button, { size: "small", danger: true, onClick: function () { onClear(agent.id); }, loading: sv, disabled: sv }, "取消") : null
        );

        var urlRow = React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 } },
          React.createElement(antd.Input, {
            style: { flex: 1 }, placeholder: "输入图片 URL…",
            value: urlIn[agent.id] || "", disabled: sv,
            onChange: function (e) { var aid = agent.id; setUrlIn(function (p) { var n = {}; for (var k in p) n[k] = p[k]; n[aid] = e.target.value; return n; }); },
            onPressEnter: function () { onSetUrl(agent.id); },
            prefix: React.createElement("span", { style: { color: "#999" } }, "🔗")
          }),
          React.createElement(antd.Button, {
            type: "primary", size: "small",
            onClick: function () { onSetUrl(agent.id); },
            loading: sv && !!(urlIn[agent.id] || "").trim(),
            disabled: !(urlIn[agent.id] || "").trim()
          }, "设置")
        );

        var btnRow = React.createElement("div", { style: { display: "flex", gap: 8 } });
        btnRow.props.children = [
          React.createElement(antd.Upload, {
            accept: "image/png,image/jpeg,image/gif,image/webp,image/svg+xml",
            showUploadList: false, disabled: sv,
            customRequest: function (o) { onUpload(agent.id, o.file, o.onSuccess); },
            key: "upload"
          }, React.createElement(antd.Button, { size: "small", icon: React.createElement("span", null, "📁"), loading: sv, disabled: sv }, "上传图片"))
        ];
        if (hasLocal) {
          btnRow.props.children.push(
            React.createElement(antd.Button, { size: "small", danger: true, key: "clear-local", onClick: function () { onClear(agent.id); }, loading: sv, disabled: sv }, "清除上传")
          );
        } else if (hasUrl) {
          btnRow.props.children.push(
            React.createElement(antd.Button, { size: "small", danger: true, key: "clear-url", onClick: function () { onClear(agent.id); }, loading: sv, disabled: sv }, "清除 URL")
          );
        }

        var infoDiv = React.createElement("div", { style: { flex: 1, minWidth: 0 } }, nameEl, descEl, fileRow, urlRow, btnRow);
        var rowDiv = React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 16 } }, avatarBox, infoDiv);

        cards.push(React.createElement(antd.Card, { key: agent.id, size: "small", style: { width: "100%" } }, rowDiv));
      })(agents[i]);
    }

    return React.createElement("div", { style: { padding: 24, maxWidth: 800, margin: "0 auto" } },
      React.createElement(antd.Typography.Title, { level: 3, style: { marginBottom: 8 } }, "🤖 Agent 头像设置"),
      React.createElement(antd.Alert, {
        type: "info", showIcon: true, style: { marginBottom: 16 },
        message: React.createElement("span", null,
          "💡 跨浏览器持久化：在插件目录 assets/avatars/ 下放置 {agent_id}.png 文件，点「启用文件路径」。",
          React.createElement("br"),
          "路径: ", React.createElement("code", { style: { fontSize: 10 } }, ASSETS_BASE + "{agent_id}.png"))
      }),
      React.createElement(antd.Typography.Paragraph, { type: "secondary", style: { marginBottom: 24 } }, "上传图片或设置 URL 仅保存在浏览器缓存中。"),
      agents.length === 0
        ? React.createElement(antd.Empty, { description: "暂无 Agent" })
        : React.createElement(antd.Space, { direction: "vertical", style: { width: "100%" }, size: 16 }, cards)
    );
  }

  window.QwenPaw.menu.add(pluginId, {
    id: "agent-avatar.settings",
    label: "Agent头像设置",
    route: "agent-avatar.settings",
    parentId: "plugins-group",
    location: "primary.settings",
    order: 1
  });

  window.QwenPaw.route.add(pluginId, {
    id: "agent-avatar.settings",
    path: "/agent-avatar/settings",
    component: AvatarSettingsPage
  });
})();
