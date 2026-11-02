
import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = "http://127.0.0.1:8000";

const cardStyle = {
  background: "#ffffff",
  padding: "24px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  marginBottom: "20px",
};

const buttonStyle = {
  padding: "12px 18px",
  border: "none",
  borderRadius: "8px",
  color: "#ffffff",
  fontWeight: 600,
  cursor: "pointer",
};

function getHeaders() {
  const token = localStorage.getItem("access_token");
  return { Authorization: `Bearer ${token}` };
}

export default function Calendar() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [syncResult, setSyncResult] = useState(null);

  async function checkStatus() {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get(
        `${API_URL}/api/v1/calendar/google/status`,
        { headers: getHeaders() }
      );

      setConnected(Boolean(response.data.connected));
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to check Google Calendar connection."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkStatus();
  }, []);

  async function connectCalendar() {
    setConnecting(true);
    setError("");
    setMessage("");

    try {
      const response = await axios.get(
        `${API_URL}/api/v1/calendar/google/connect`,
        { headers: getHeaders() }
      );

      const authorizationUrl = response.data.authorization_url;

      if (!authorizationUrl) {
        throw new Error("Authorization URL was not returned by the server.");
      }

      window.location.assign(authorizationUrl);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Could not start Google Calendar connection."
      );
      setConnecting(false);
    }
  }

  async function syncApprovedLeaves() {
    setSyncing(true);
    setError("");
    setMessage("");
    setSyncResult(null);

    try {
      const response = await axios.post(
        `${API_URL}/api/v1/calendar/sync/approved-leaves`,
        null,
        { headers: getHeaders() }
      );

      setSyncResult(response.data);
      setMessage(response.data.message || "Calendar synchronization completed.");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to synchronize approved leaves."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function disconnectCalendar() {
    const confirmed = window.confirm(
      "Are you sure you want to disconnect Google Calendar?"
    );

    if (!confirmed) return;

    setDisconnecting(true);
    setError("");
    setMessage("");
    setSyncResult(null);

    try {
      const response = await axios.delete(
        `${API_URL}/api/v1/calendar/google/disconnect`,
        { headers: getHeaders() }
      );

      setConnected(false);
      setMessage(response.data.message || "Google Calendar disconnected.");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to disconnect Google Calendar."
      );
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "30px 20px",
        color: "#1e293b",
      }}
    >
      <div style={{ maxWidth: "950px", margin: "0 auto" }}>
        <h1 style={{ marginBottom: "8px" }}>Google Calendar Integration</h1>
        <p style={{ color: "#64748b", marginBottom: "28px" }}>
          Connect Google Calendar and synchronize approved employee leaves.
        </p>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Connection Status</h2>

          {loading ? (
            <p>Checking Google Calendar connection...</p>
          ) : (
            <p
              style={{
                fontWeight: 700,
                color: connected ? "#15803d" : "#b45309",
              }}
            >
              {connected ? "● Connected" : "● Not connected"}
            </p>
          )}

          <button
            type="button"
            onClick={checkStatus}
            disabled={loading}
            style={{
              ...buttonStyle,
              background: "#475569",
              marginRight: "10px",
            }}
          >
            Refresh Status
          </button>

          {!connected && !loading && (
            <button
              type="button"
              onClick={connectCalendar}
              disabled={connecting}
              style={{
                ...buttonStyle,
                background: "#2563eb",
              }}
            >
              {connecting ? "Connecting..." : "Connect Google Calendar"}
            </button>
          )}

          {connected && (
            <button
              type="button"
              onClick={disconnectCalendar}
              disabled={disconnecting}
              style={{
                ...buttonStyle,
                background: "#dc2626",
              }}
            >
              {disconnecting ? "Disconnecting..." : "Disconnect Calendar"}
            </button>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Approved Leave Synchronization</h2>
          <p style={{ color: "#64748b", lineHeight: 1.6 }}>
            Synchronize approved employee leave requests with your connected
            Google Calendar.
          </p>

          <button
            type="button"
            onClick={syncApprovedLeaves}
            disabled={!connected || syncing || loading}
            style={{
              ...buttonStyle,
              background: connected ? "#2563eb" : "#94a3b8",
              cursor: connected ? "pointer" : "not-allowed",
            }}
          >
            {syncing ? "Synchronizing..." : "Sync Approved Leaves"}
          </button>

          {!connected && !loading && (
            <p style={{ color: "#b45309" }}>
              Connect Google Calendar before synchronizing leaves.
            </p>
          )}
        </section>

        {message && (
          <div
            role="status"
            style={{
              ...cardStyle,
              color: "#166534",
              background: "#f0fdf4",
              borderColor: "#bbf7d0",
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              ...cardStyle,
              color: "#b91c1c",
              background: "#fef2f2",
              borderColor: "#fecaca",
            }}
          >
            {error}
          </div>
        )}

        {syncResult && (
          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Synchronization Results</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "14px",
              }}
            >
              {[
                ["Approved Leaves", syncResult.total_approved_leaves],
                ["Events Created", syncResult.created_events],
                ["Already Synced", syncResult.already_synced],
                ["Failed", syncResult.failed],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    padding: "18px",
                    background: "#f8fafc",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <p style={{ color: "#64748b", margin: "0 0 8px" }}>
                    {label}
                  </p>
                  <h2 style={{ margin: 0 }}>{value ?? 0}</h2>
                </div>
              ))}
            </div>

            {syncResult.failures?.length > 0 && (
              <div style={{ marginTop: "18px" }}>
                <h3>Synchronization Errors</h3>
                {syncResult.failures.map((failure, index) => (
                  <p key={index} style={{ color: "#b91c1c" }}>
                    {typeof failure === "string"
                      ? failure
                      : JSON.stringify(failure)}
                  </p>
                ))}
              </div>
            )}
          </section>
        )}

        <button
          type="button"
          onClick={() => (window.location.href = "/dashboard")}
          style={{
            ...buttonStyle,
            background: "#475569",
          }}
        >
          Back to Dashboard
        </button>
      </div>
    </main>
  );
}
