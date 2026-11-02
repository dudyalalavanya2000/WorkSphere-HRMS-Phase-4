
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const styles = {
  page: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "28px 20px",
    color: "#1e293b",
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "16px",
  },
  button: {
    padding: "10px 14px",
    border: "none",
    borderRadius: "8px",
    background: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 600,
  },
  secondaryButton: {
    padding: "9px 13px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#334155",
    cursor: "pointer",
    fontWeight: 600,
  },
};

function getNotificationId(notification) {
  return notification.id ?? notification.notification_id;
}

function isRead(notification) {
  return (
    notification.is_read === true ||
    notification.read === true ||
    String(notification.status || "").toUpperCase() === "READ"
  );
}

function getMessage(notification) {
  return (
    notification.message ||
    notification.content ||
    notification.description ||
    "You have a new notification."
  );
}

function getTitle(notification) {
  return notification.title || notification.subject || "Notification";
}

function getDate(notification) {
  const value =
    notification.created_at ||
    notification.created_on ||
    notification.timestamp;

  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString();
}

export default function Notifications() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("access_token");

    return token
      ? { Authorization: `Bearer ${token}` }
      : null;
  }, []);

  const handleRequestError = useCallback(
    (err) => {
      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        localStorage.removeItem("username");
        navigate("/");
        return;
      }

      setError(
        err.response?.data?.detail ||
          "Unable to complete the notification request."
      );
    },
    [navigate]
  );

  const loadNotifications = useCallback(async () => {
    const headers = getHeaders();

    if (!headers) {
      navigate("/");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const [listResult, countResult] = await Promise.all([
        axios.get(`${API_URL}/api/v1/notifications/`, { headers }),
        axios.get(`${API_URL}/api/v1/notifications/unread-count`, {
          headers,
        }),
      ]);

      const listData = listResult.data;
      const items = Array.isArray(listData)
        ? listData
        : listData.notifications ??
          listData.items ??
          listData.results ??
          [];

      setNotifications(items);

      const countData = countResult.data;
      const count =
        typeof countData === "number"
          ? countData
          : countData.unread_count ??
            countData.count ??
            countData.unread ??
            items.filter((item) => !isRead(item)).length;

      setUnreadCount(Number(count) || 0);
    } catch (err) {
      handleRequestError(err);
    } finally {
      setLoading(false);
    }
  }, [getHeaders, handleRequestError, navigate]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function markAsRead(notification) {
    if (isRead(notification)) return;

    const id = getNotificationId(notification);

    if (id == null) {
      setError("This notification has no ID, so it cannot be marked as read.");
      return;
    }

    const headers = getHeaders();
    if (!headers) {
      navigate("/");
      return;
    }

    setBusyId(id);
    setError("");
    setNotice("");

    try {
      await axios.patch(
        `${API_URL}/api/v1/notifications/${id}/read`,
        {},
        { headers }
      );

      setNotice("Notification marked as read.");
      await loadNotifications();
    } catch (err) {
      handleRequestError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function markAllAsRead() {
    if (unreadCount === 0) return;

    const headers = getHeaders();
    if (!headers) {
      navigate("/");
      return;
    }

    setMarkingAll(true);
    setError("");
    setNotice("");

    try {
      await axios.patch(
        `${API_URL}/api/v1/notifications/read-all`,
        {},
        { headers }
      );

      setNotice("All notifications marked as read.");
      await loadNotifications();
    } catch (err) {
      handleRequestError(err);
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <main style={styles.page}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: "30px" }}>
            Notifications
          </h1>
          <p style={{ margin: 0, color: "#64748b" }}>
            Stay updated on your WorkSphere activities.
          </p>
        </div>

        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() => navigate("/dashboard")}
        >
          Back to Dashboard
        </button>
      </div>

      <section style={styles.panel}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ color: "#64748b", margin: "0 0 6px" }}>
              Unread notifications
            </p>
            <h2 style={{ margin: 0, fontSize: "28px" }}>
              {unreadCount}
            </h2>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={loadNotifications}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              style={{
                ...styles.button,
                opacity:
                  markingAll || unreadCount === 0 ? 0.6 : 1,
              }}
              onClick={markAllAsRead}
              disabled={markingAll || unreadCount === 0}
            >
              {markingAll ? "Updating..." : "Mark All as Read"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            color: "#b91c1c",
            padding: "14px",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          {error}
          <button
            type="button"
            style={{ ...styles.secondaryButton, marginLeft: "10px" }}
            onClick={loadNotifications}
          >
            Try Again
          </button>
        </div>
      )}

      {notice && (
        <p
          role="status"
          style={{
            background: "#f0fdf4",
            color: "#166534",
            padding: "12px",
            borderRadius: "8px",
          }}
        >
          {notice}
        </p>
      )}

      {loading && notifications.length === 0 ? (
        <p>Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <section style={styles.panel}>
          <h3>No notifications yet</h3>
          <p style={{ color: "#64748b", marginBottom: 0 }}>
            Notifications about your HR activities will appear here.
          </p>
        </section>
      ) : (
        <div>
          {notifications.map((notification, index) => {
            const id = getNotificationId(notification);
            const read = isRead(notification);

            return (
              <article
                key={id ?? index}
                style={{
                  ...styles.panel,
                  borderLeft: `4px solid ${
                    read ? "#cbd5e1" : "#2563eb"
                  }`,
                  background: read ? "#ffffff" : "#eff6ff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: "1 1 250px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <h3 style={{ margin: "0 0 8px" }}>
                        {getTitle(notification)}
                      </h3>

                      <span
                        style={{
                          fontSize: "12px",
                          padding: "3px 8px",
                          borderRadius: "12px",
                          background: read ? "#e2e8f0" : "#dbeafe",
                          color: read ? "#475569" : "#1d4ed8",
                        }}
                      >
                        {read ? "Read" : "Unread"}
                      </span>
                    </div>

                    <p style={{ margin: "0 0 10px", lineHeight: 1.6 }}>
                      {getMessage(notification)}
                    </p>

                    <p
                      style={{
                        margin: 0,
                        color: "#64748b",
                        fontSize: "12px",
                      }}
                    >
                      {getDate(notification)}
                    </p>
                  </div>

                  {!read && (
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      disabled={busyId === id}
                      onClick={() => markAsRead(notification)}
                    >
                      {busyId === id ? "Updating..." : "Mark as Read"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
