(function () {
  var React = window.QwenPaw.host.React;
  var antd = window.QwenPaw.host.antd;
  var pluginId = "agent-avatar";

  // ── LocalStorage storage ──────────────────────────────────────
  var avatarCache = {};
  var agentNameCache = {};

  function loadAvatarCache() {
    try {
      var raw = localStorage.getItem("agent-avatar-config");
      avatarCache = raw ? JSON.parse(raw) : {};
    } catch (e) {
      avatarCache = {};
    }
  }

  function loadAgentNameCache() {
    try {
      var raw = localStorage.getItem("agent-avatar-agents");
      agentNameCache = raw ? JSON.parse(raw) : {};
    } catch (e) {
      agentNameCache = {};
    }
  }

  function syncCaches() {
    loadAvatarCache();
    loadAgentNameCache();
  }

  syncCaches();

  function getCachedAvatar(agentId) {
    var entry = avatarCache[agentId];
    if (!entry) return null;
    if (entry.type === "file") return entry.data;
    return entry.url || null;
  }

  function getCachedAgentName(agentId) {
    return agentNameCache[agentId] || null;
  }

  // ── Apply avatar to current agent ─────────────────────────────
  function applyAvatar() {
    var agentId = window.QwenPaw.host.getSelectedAgentId();
    if (!agentId) return;
    var url = getCachedAvatar(agentId);
    var nick = getCachedAgentName(agentId) || agentId;

    window.QwenPaw.chat.welcome.set(pluginId, {
      avatar: url || undefined,
      nick: nick
    });

    window.QwenPaw.chat.leftHeader.set(pluginId, {
      title: nick,
      logo: url
        ? React.createElement("img", {
            src: url,
            style: {
              height: 22,
              width: 22,
              borderRadius: "50%",
              objectFit: "cover"
            }
          })
        : undefined
    });
  }

  // ── Watcher (reacts to agent switch) ──────────────────────────
  function AvatarWatcher() {
    var agent = window.QwenPaw.host.useSelectedAgent();
    React.useEffect(function () {
      syncCaches();
      applyAvatar();
    }, [agent ? agent.id : null]);
    return null;
  }

  window.QwenPaw.slot.fill(pluginId, "content.statusBar", function () {
    return React.createElement(AvatarWatcher);
  });

  // ── Persistence helpers ───────────────────────────────────────
  function saveConfig() {
    localStorage.setItem("agent-avatar-config", JSON.stringify(avatarCache));
    syncCaches();
    applyAvatar();
  }

  function setUrl(agentId, url) {
    if (!url) return;
    avatarCache[agentId] = {
      type: "url",
      url: url,
      agentId: agentId,
      updatedAt: Date.now()
    };
    saveConfig();
  }

  function setFile(agentId, dataUrl, filename) {
    avatarCache[agentId] = {
      type: "file",
      data: dataUrl,
      filename: filename,
      agentId: agentId,
      updatedAt: Date.now()
    };
    saveConfig();
  }

  function clearAvatar(agentId) {
    delete avatarCache[agentId];
    saveConfig();
  }

  // ── Load agents from API ──────────────────────────────────────
  async function fetchAgents() {
    var result = [];
    try {
      var resp = await window.QwenPaw.host.fetch("/agents");
      if (resp.ok) {
        var data = await resp.json();
        for (var i = 0; i < data.agents.length; i++) {
          var agent = data.agents[i];
          if (agent.id && agent.name) {
            result.push(agent);
            agentNameCache[agent.id] = agent.name;
          }
        }
      } else {
        var resp2 = await fetch("/api/agents");
        if (resp2.ok) {
          var data2 = await resp2.json();
          for (var j = 0; j < data2.agents.length; j++) {
            var agent2 = data2.agents[j];
            if (agent2.id && agent2.name) {
              result.push(agent2);
              agentNameCache[agent2.id] = agent2.name;
            }
          }
        }
      }
      localStorage.setItem("agent-avatar-agents", JSON.stringify(agentNameCache));
    } catch (e) {
      console.warn("[AgentAvatar] Failed to load agents:", e.message || e);
    }
    return result;
  }

  // ── Settings Page Component ───────────────────────────────────
  function AvatarSettingsPage() {
    var agentsState = React.useState([]);
    var agents = agentsState[0];
    var setAgents = agentsState[1];

    var configState = React.useState({});
    var avatarConfig = configState[0];
    var setAvatarConfig = configState[1];

    var loadingState = React.useState(true);
    var loading = loadingState[0];
    var setLoading = loadingState[1];

    var errorState = React.useState(null);
    var error = errorState[0];
    var setError = errorState[1];

    var savingState = React.useState(null);
    var savingId = savingState[0];
    var setSavingId = savingState[1];

    var inputsState = React.useState({});
    var urlInputs = inputsState[0];
    var setUrlInputs = inputsState[1];

    var loadData = React.useCallback(async function () {
      setLoading(true);
      setError(null);

      var agentsData = await fetchAgents();
      if (agentsData.length > 0) {
        setAgents(agentsData);
      } else {
        setError("无法加载 Agent 列表，请确认 QwenPaw 桌面端运行正常。");
      }

      loadAvatarCache();
      setAvatarConfig(avatarCache);
      setLoading(false);
    }, []);

    React.useEffect(function () {
      syncCaches();
      loadData();
    }, [loadData]);

    function getAvatarUrl(agentId) {
      var entry = avatarConfig[agentId];
      if (!entry) return null;
      if (entry.type === "file") return entry.data;
      return entry.url || null;
    }

    var onSetUrl = React.useCallback(async function (agentId) {
      var url = (urlInputs[agentId] || "").trim();
      if (!url) return;
      setSavingId(agentId);
      try {
        setUrl(agentId, url);
        setUrlInputs(function (prev) {
          var next = {};
          for (var k in prev) next[k] = prev[k];
          next[agentId] = "";
          return next;
        });
        await loadData();
      } finally {
        setSavingId(null);
      }
    }, [urlInputs, loadData]);

    var onUpload = React.useCallback(async function (agentId, file, onSuccess) {
      setSavingId(agentId);
      try {
        if (file) {
          var dataUrl = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(reader.error); };
            reader.readAsDataURL(file);
          });
          setFile(agentId, dataUrl, file.name);
          if (onSuccess) onSuccess();
          await loadData();
        }
      } finally {
        setSavingId(null);
      }
    }, [loadData]);

    var onClear = React.useCallback(async function (agentId) {
      setSavingId(agentId);
      try {
        clearAvatar(agentId);
        await loadData();
      } finally {
        setSavingId(null);
      }
    }, [loadData]);

    // ── Render ──────────────────────────────────────────────────
    if (loading) {
      return React.createElement(antd.Spin, {
        style: { display: "block", margin: "80px auto" },
        size: "large"
      });
    }

    if (error) {
      return React.createElement(
        "div",
        { style: { padding: 24, maxWidth: 800, margin: "0 auto" } },
        React.createElement(antd.Alert, {
          type: "error",
          message: "加载失败",
          description: error,
          showIcon: true,
          action: React.createElement(
            antd.Button,
            { onClick: loadData, size: "small" },
            "重试"
          )
        })
      );
    }

    var agentCards = [];
    for (var i = 0; i < agents.length; i++) {
      var agent = agents[i];
      var avatarUrl = getAvatarUrl(agent.id);
      var isSaving = savingId === agent.id;

      agentCards.push(
        React.createElement(
          antd.Card,
          {
            key: agent.id,
            size: "small",
            style: { width: "100%" }
          },
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 16 } },

            // Avatar preview
            React.createElement(
              "div",
              {
                style: {
                  width: 56, height: 56, borderRadius: "50%",
                  overflow: "hidden", flexShrink: 0, background: "#f0f0f0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "2px solid #e8e8e8"
                }
              },
              avatarUrl
                ? React.createElement("img", {
                    src: avatarUrl,
                    style: { width: "100%", height: "100%", objectFit: "cover" },
                    alt: agent.id
                  })
                : React.createElement(
                    "span",
                    { style: { fontSize: 20, color: "#bbb", fontWeight: "bold" } },
                    (agent.name || "?").charAt(0).toUpperCase()
                  )
            ),

            // Info + controls
            React.createElement(
              "div",
              { style: { flex: 1, minWidth: 0 } },

              React.createElement(
                "div",
                { style: { fontWeight: 600, fontSize: 15, marginBottom: 2 } },
                agent.name || agent.id
              ),

              React.createElement(
                "div",
                {
                  style: {
                    fontSize: 12, color: "#999", marginBottom: 10,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                  }
                },
                agent.description || agent.id
              ),

              // URL input row
              React.createElement(
                "div",
                { style: { display: "flex", gap: 8, alignItems: "center" } },

                React.createElement(antd.Input, {
                  style: { flex: 1 },
                  placeholder: "输入图片 URL…",
                  value: urlInputs[agent.id] || "",
                  onChange: (function (aid) {
                    return function (e) {
                      setUrlInputs(function (prev) {
                        var next = {};
                        for (var k in prev) next[k] = prev[k];
                        next[aid] = e.target.value;
                        return next;
                      });
                    };
                  })(agent.id),
                  onPressEnter: (function (aid) {
                    return function () { onSetUrl(aid); };
                  })(agent.id),
                  prefix: React.createElement("span", { style: { color: "#999" } }, "🔗"),
                  disabled: isSaving
                }),

                React.createElement(
                  antd.Button,
                  {
                    type: "primary",
                    onClick: (function (aid) {
                      return function () { onSetUrl(aid); };
                    })(agent.id),
                    loading: isSaving && !!(urlInputs[agent.id] || "").trim(),
                    disabled: !(urlInputs[agent.id] || "").trim()
                  },
                  "设置"
                )
              ),

              // Action buttons
              React.createElement(
                "div",
                { style: { display: "flex", gap: 8, marginTop: 8 } },

                React.createElement(
                  antd.Upload,
                  {
                    accept: "image/png,image/jpeg,image/gif,image/webp,image/svg+xml",
                    showUploadList: false,
                    customRequest: (function (aid) {
                      return function (opt) {
                        onUpload(aid, opt.file, opt.onSuccess);
                      };
                    })(agent.id),
                    disabled: isSaving
                  },
                  React.createElement(
                    antd.Button,
                    {
                      icon: React.createElement("span", null, "📁"),
                      loading: isSaving,
                      disabled: isSaving
                    },
                    "上传图片"
                  )
                ),

                avatarUrl
                  ? React.createElement(
                      antd.Button,
                      {
                        danger: true,
                        onClick: (function (aid) {
                          return function () { onClear(aid); };
                        })(agent.id),
                        loading: isSaving,
                        disabled: isSaving
                      },
                      "🗑 清除头像"
                    )
                  : null
              )
            )
          )
        )
      );
    }

    return React.createElement(
      "div",
      { style: { padding: 24, maxWidth: 800, margin: "0 auto" } },
      React.createElement(antd.Typography.Title, { level: 3, style: { marginBottom: 8 } }, "🤖 Agent 头像设置"),
      React.createElement(
        antd.Typography.Paragraph,
        { type: "secondary", style: { marginBottom: 24 } },
        "为每个智能体设置自定义头像。支持上传本地图片或输入远程图片 URL。"
      ),
      agents.length === 0
        ? React.createElement(antd.Empty, {
            description: "暂无 Agent，或无法加载 Agent 列表"
          })
        : React.createElement(
            antd.Space,
            { direction: "vertical", style: { width: "100%" }, size: 16 },
            agentCards
          )
    );
  }

  // ── Register menu & route ─────────────────────────────────────
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
