// ────────────────────────────────────────────────────────────────────
// Agent Avatar Plugin — Frontend Entry
// Backend-driven: avatar config stored per-agent in workspace directory
// ────────────────────────────────────────────────────────────────────

const { React, antd } = window.QwenPaw.host;
const pluginId = "agent-avatar";

// ── Backend API helper (host.fetch auto-prepends /api) ─────────────
function api(path: string, options?: RequestInit): Promise<Response> {
  return window.QwenPaw.host.fetch(`/agent-avatar${path}`, options);
}

// ── Agent-scoped avatar config & name cache ───────────────────────
let sAvatarConfig: Record<string, any> = {};
let sAgentNameCache: Record<string, string> = {};

async function refreshAvatarConfig(): Promise<void> {
  try {
    const resp = await api("/config");
    if (resp.ok) {
      const data = await resp.json();
      sAvatarConfig = data.agents || {};
    } else {
      sAvatarConfig = {};
    }
  } catch {
    sAvatarConfig = {};
  }
}

async function refreshAgentNames(): Promise<void> {
  try {
    const resp = await api("/agents");
    if (resp.ok) {
      const data = await resp.json();
      for (const a of data.agents || []) {
        if (a.id && a.name) sAgentNameCache[a.id] = a.name;
      }
    }
  } catch {
    // name fetch failed — fine, will fall back to agent.id
  }
}

function getAvatarUrl(agentId: string): string | null {
  const entry = sAvatarConfig[agentId];
  if (!entry) return null;
  return entry.value ?? null;
}

function getAgentName(agentId: string): string | null {
  return sAgentNameCache[agentId] ?? null;
}

// ── Apply avatar to welcome & header ──────────────────────────────
async function applyAvatar() {
  const agentId = window.QwenPaw.host.getSelectedAgentId();
  if (!agentId) return;
  const url = getAvatarUrl(agentId);
  const nick = getAgentName(agentId) || agentId;

  window.QwenPaw.chat.welcome.set(pluginId, {
    avatar: url ?? undefined,
    nick,
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
            objectFit: "cover",
          },
        })
      : undefined,
  });
}

// ── Watcher component ─────────────────────────────────────────────
function AvatarWatcher() {
  const agent = window.QwenPaw.host.useSelectedAgent();
  React.useEffect(() => {
    Promise.all([refreshAvatarConfig(), refreshAgentNames()]).then(applyAvatar);
  }, [agent?.id]);
  return null;
}

window.QwenPaw.slot.fill(pluginId, "content.statusBar", () =>
  React.createElement(AvatarWatcher),
);

// ── Settings Page ──────────────────────────────────────────────────
function refreshCaches() {
  // no-op in backend mode: data loaded via API
}

async function loadAgents(): Promise<any[]> {
  const agents: any[] = [];
  try {
    const resp = await api("/agents");
    if (resp.ok) {
      const data = await resp.json();
      for (const agent of data.agents || []) {
        if (agent.id && agent.name) {
          agents.push(agent);
          sAgentNameCache[agent.id] = agent.name;
        }
      }
    }
  } catch (e: any) {
    console.warn("[AgentAvatar] Failed to load agents:", e?.message || e);
  }
  return agents;
}

function AvatarSettingsPage() {
  const [agents, setAgents] = React.useState<any[]>([]);
  const [pageConfig, setPageConfig] = React.useState<Record<string, any>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [urlInputs, setUrlInputs] = React.useState<Record<string, string>>({});

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const agentsData = await loadAgents();
    if (agentsData.length > 0) {
      setAgents(agentsData);
    } else {
      setError("无法加载 Agent 列表，请确认 QwenPaw 桌面端运行正常。");
    }

    await refreshAvatarConfig();
    setPageConfig(sAvatarConfig);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const getPageAvatarUrl = React.useCallback(
    (agentId: string): string | null => {
      const entry = pageConfig[agentId];
      if (!entry) return null;
      return entry.value ?? null;
    },
    [pageConfig],
  );

  const onSetUrl = React.useCallback(
    async (agentId: string) => {
      const url = urlInputs[agentId]?.trim();
      if (!url) return;
      setSavingId(agentId);
      try {
        const resp = await api(`/config/${agentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "url", url }),
        });
        if (!resp.ok) {
          console.warn("[AgentAvatar] PUT config failed:", resp.status);
        }
        setUrlInputs((prev) => ({ ...prev, [agentId]: "" }));
        await loadData();
      } finally {
        setSavingId(null);
      }
    },
    [urlInputs, loadData],
  );

  const onUpload = React.useCallback(
    async (agentId: string, file: File, onSuccess?: () => void) => {
      setSavingId(agentId);
      try {
        if (file) {
          const formData = new FormData();
          formData.append("file", file);
          const resp = await api(`/upload/${agentId}`, {
            method: "POST",
            body: formData,
          });
          if (!resp.ok) {
            console.warn("[AgentAvatar] Upload failed:", resp.status);
          }
          onSuccess?.();
          await loadData();
        }
      } finally {
        setSavingId(null);
      }
    },
    [loadData],
  );

  const onClear = React.useCallback(
    async (agentId: string) => {
      setSavingId(agentId);
      try {
        const resp = await api(`/config/${agentId}`, { method: "DELETE" });
        if (!resp.ok) {
          console.warn("[AgentAvatar] DELETE config failed:", resp.status);
        }
        await loadData();
      } finally {
        setSavingId(null);
      }
    },
    [loadData],
  );

  // ── Render ────────────────────────────────────────────────────
  if (loading) {
    return React.createElement(antd.Spin, {
      style: { display: "block", margin: "80px auto" },
      size: "large",
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
          "重试",
        ),
      }),
    );
  }

  return React.createElement(
    "div",
    { style: { padding: 24, maxWidth: 800, margin: "0 auto" } },
    React.createElement(antd.Typography.Title, { level: 3, style: { marginBottom: 8 } }, "🤖 Agent 头像设置"),
    React.createElement(
      antd.Typography.Paragraph,
      { type: "secondary", style: { marginBottom: 24 } },
      "为每个智能体设置自定义头像。支持上传本地图片或输入远程图片 URL。",
    ),
    agents.length === 0
      ? React.createElement(antd.Empty, {
          description: "暂无 Agent，或无法加载 Agent 列表",
        })
      : React.createElement(
          antd.Space,
          { direction: "vertical", style: { width: "100%" }, size: 16 },
          agents.map((agent: any) => {
            const avatarUrl = getPageAvatarUrl(agent.id);
            const isSaving = savingId === agent.id;
            return React.createElement(
              antd.Card,
              {
                key: agent.id,
                size: "small",
                style: { width: "100%" },
              },
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: 16 } },

                // Avatar preview
                React.createElement(
                  "div",
                  {
                    style: {
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      overflow: "hidden",
                      flexShrink: 0,
                      background: "#f0f0f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid #e8e8e8",
                    },
                  },
                  avatarUrl
                    ? React.createElement("img", {
                        src: avatarUrl,
                        style: { width: "100%", height: "100%", objectFit: "cover" },
                        alt: agent.id,
                      })
                    : React.createElement(
                        "span",
                        {
                          style: { fontSize: 20, color: "#bbb", fontWeight: "bold" },
                        },
                        agent.name?.charAt(0)?.toUpperCase() || "?",
                      ),
                ),

                // Info + controls
                React.createElement(
                  "div",
                  { style: { flex: 1, minWidth: 0 } },
                  React.createElement(
                    "div",
                    { style: { fontWeight: 600, fontSize: 15, marginBottom: 2 } },
                    agent.name || agent.id,
                  ),
                  React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 12,
                        color: "#999",
                        marginBottom: 10,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      },
                    },
                    agent.description || agent.id,
                  ),

                  // URL input row
                  React.createElement(
                    "div",
                    { style: { display: "flex", gap: 8, alignItems: "center" } },
                    React.createElement(antd.Input, {
                      style: { flex: 1 },
                      placeholder: "输入图片 URL…",
                      value: urlInputs[agent.id] ?? "",
                      onChange: (e: any) =>
                        setUrlInputs((prev) => ({
                          ...prev,
                          [agent.id]: e.target.value,
                        })),
                      onPressEnter: () => onSetUrl(agent.id),
                      prefix: React.createElement("span", { style: { color: "#999" } }, "🔗"),
                      disabled: isSaving,
                    }),
                    React.createElement(
                      antd.Button,
                      {
                        type: "primary",
                        onClick: () => onSetUrl(agent.id),
                        loading: isSaving && !!urlInputs[agent.id]?.trim(),
                        disabled: !urlInputs[agent.id]?.trim(),
                      },
                      "设置",
                    ),
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
                        customRequest: ({
                          file,
                          onSuccess,
                        }: {
                          file: File;
                          onSuccess?: () => void;
                        }) => onUpload(agent.id, file, onSuccess),
                        disabled: isSaving,
                      },
                      React.createElement(
                        antd.Button,
                        {
                          icon: React.createElement("span", {}, "📁"),
                          loading: isSaving,
                          disabled: isSaving,
                        },
                        "上传图片",
                      ),
                    ),
                    avatarUrl
                      ? React.createElement(
                          antd.Button,
                          {
                            danger: true,
                            onClick: () => onClear(agent.id),
                            loading: isSaving,
                            disabled: isSaving,
                          },
                          "🗑 清除头像",
                        )
                      : null,
                  ),
                ),
              ),
            );
          }),
        ),
  );
}

// ── Register menu & route ──────────────────────────────────────────
window.QwenPaw.menu.add(pluginId, {
  id: "agent-avatar.settings",
  label: "Agent头像设置",
  route: "agent-avatar.settings",
  parentId: "plugins-group",
  location: "primary.settings",
  order: 1,
});

window.QwenPaw.route.add(pluginId, {
  id: "agent-avatar.settings",
  path: "/agent-avatar/settings",
  component: AvatarSettingsPage,
});
