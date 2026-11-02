
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = "http://127.0.0.1:8000";

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "—";

  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return String(value);

  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function formatTime(value) {
  if (!value) return "Not recorded";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatOvertime(minutes = 0) {
  const total = Number(minutes) || 0;
  const hours = Math.floor(total / 60);
  const remainingMinutes = total % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;

  return `${hours} hr ${remainingMinutes} min`;
}

function statusLabel(status) {
  switch (status) {
    case "PRESENT":
      return "ON TIME";
    case "LATE":
      return "LATE";
    case "ABSENT":
      return "ABSENT";
    default:
      return status || "NOT RECORDED";
  }
}

function statusColors(status) {
  switch (status) {
    case "PRESENT":
      return { background: "#ecfdf3", color: "#067647" };
    case "LATE":
      return { background: "#fff4e5", color: "#b54708" };
    case "ABSENT":
      return { background: "#fef3f2", color: "#b42318" };
    default:
      return { background: "#f2f4f7", color: "#344054" };
  }
}

export default function Attendance() {
  const navigate = useNavigate();

  const token = localStorage.getItem("access_token");
  const username = localStorage.getItem("username") || "User";
  const role = (
    localStorage.getItem("user_role") || "EMPLOYEE"
  ).toUpperCase();

  const isHR = role === "HR" || role === "ADMIN";
  const today = getLocalDate();

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const todayRecord = records.find(
    (record) =>
      String(record.attendance_date).slice(0, 10) === today
  );

  const checkedIn = Boolean(todayRecord?.check_in);
  const checkedOut = Boolean(todayRecord?.check_out);
  const markedAbsent = todayRecord?.status === "ABSENT";

  const loadAttendance = useCallback(async () => {
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    setLoading(true);
    setError("");

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      if (isHR) {
        const params = selectedDate
          ? { attendance_date: selectedDate }
          : {};

        const [attendanceResponse, summaryResponse] =
          await Promise.all([
            axios.get(`${API_URL}/api/v1/attendance/`, {
              headers,
              params,
            }),
            axios.get(`${API_URL}/api/v1/attendance/summary`, {
              headers,
              params,
            }),
          ]);

        setRecords(attendanceResponse.data);
        setSummary(summaryResponse.data);
      } else {
        const response = await axios.get(
          `${API_URL}/api/v1/attendance/me`,
          { headers }
        );

        setRecords(response.data);
        setSummary(null);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        localStorage.removeItem("username");
        navigate("/", { replace: true });
        return;
      }

      setError(
        err.response?.data?.detail ||
          "Unable to load attendance records. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [token, isHR, selectedDate, navigate]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  async function handleAttendanceAction(action) {
    setWorking(true);
    setError("");
    setMessage("");

    try {
      const response = await axios.post(
        `${API_URL}/api/v1/attendance/${action}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (action === "check-in") {
        setMessage(
          response.data.status === "LATE"
            ? "Check-in recorded. You are marked late."
            : "Check-in recorded successfully. You are on time."
        );
      } else {
        setMessage(
          `Check-out recorded successfully. Overtime: ${formatOvertime(
            response.data.overtime_minutes
          )}.`
        );
      }

      await loadAttendance();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to record attendance. Please try again."
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleMarkAbsent() {
    if (
      !window.confirm(
        `Mark employees without attendance as absent for ${formatDate(
          selectedDate
        )}?`
      )
    ) {
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");

    try {
      const response = await axios.post(
        `${API_URL}/api/v1/attendance/mark-absent`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            attendance_date: selectedDate,
          },
        }
      );

      setMessage(
        `${response.data.absent_records_created} absent record(s) created for ${formatDate(
          selectedDate
        )}.`
      );

      await loadAttendance();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to mark absent. Please try again."
      );
    } finally {
      setWorking(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("username");
    navigate("/", { replace: true });
  }

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#f5f7fb",
      color: "#172033",
      fontFamily: "Arial, sans-serif",
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: "16px",
      padding: "18px 6%",
      background: "#fff",
      borderBottom: "1px solid #e5eaf2",
    },
    brand: {
      color: "#192b45",
      fontSize: "22px",
      fontWeight: 800,
    },
    headerActions: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "12px",
    },
    button: {
      padding: "10px 16px",
      border: "1px solid #d7dfeb",
      borderRadius: "8px",
      background: "#fff",
      color: "#263b63",
      cursor: "pointer",
      font: "inherit",
    },
    primaryButton: {
      padding: "12px 18px",
      border: "none",
      borderRadius: "8px",
      background: "#2457d6",
      color: "#fff",
      cursor: "pointer",
      font: "inherit",
      fontWeight: 700,
    },
    dangerButton: {
      padding: "12px 18px",
      border: "none",
      borderRadius: "8px",
      background: "#b42318",
      color: "#fff",
      cursor: "pointer",
      font: "inherit",
      fontWeight: 700,
    },
    content: {
      maxWidth: "1150px",
      margin: "0 auto",
      padding: "38px 22px",
    },
    eyebrow: {
      color: "#7893b6",
      fontSize: "11px",
      fontWeight: 700,
      letterSpacing: "2px",
    },
    title: {
      margin: "8px 0",
      fontSize: "clamp(28px, 4vw, 36px)",
    },
    subtitle: {
      color: "#64748b",
      lineHeight: 1.7,
    },
    panel: {
      marginTop: "24px",
      padding: "24px",
      border: "1px solid #e5eaf2",
      borderRadius: "14px",
      background: "#fff",
      boxShadow: "0 5px 18px rgba(20, 35, 65, 0.04)",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: "16px",
      marginTop: "20px",
    },
    stat: {
      padding: "18px",
      border: "1px solid #e5eaf2",
      borderRadius: "10px",
      background: "#fff",
      minWidth: 0,
    },
    statLabel: {
      color: "#64748b",
      fontSize: "13px",
    },
    statValue: {
      display: "block",
      marginTop: "8px",
      fontSize: "24px",
      fontWeight: 800,
      overflowWrap: "anywhere",
    },
    tableWrapper: {
      width: "100%",
      overflowX: "auto",
      marginTop: "18px",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      textAlign: "left",
      fontSize: "14px",
    },
    cell: {
      padding: "13px 12px",
      borderBottom: "1px solid #edf0f5",
      whiteSpace: "nowrap",
    },
    input: {
      minHeight: "42px",
      padding: "9px 12px",
      border: "1px solid #d0d5dd",
      borderRadius: "8px",
      background: "#fff",
      color: "#172033",
      font: "inherit",
    },
    notice: {
      marginTop: "18px",
      padding: "13px 15px",
      borderRadius: "8px",
      fontSize: "14px",
      lineHeight: 1.5,
    },
    badge: {
      display: "inline-block",
      padding: "5px 9px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: 700,
    },
    disabledButton: {
      opacity: 0.55,
      cursor: "not-allowed",
    },
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>WorkSphere</div>

        <div style={styles.headerActions}>
          <span style={{ color: "#64748b", fontSize: "13px" }}>
            {username} · {role}
          </span>

          <button
            style={styles.button}
            onClick={() => navigate("/dashboard")}
          >
            ← Dashboard
          </button>

          <button style={styles.button} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <main style={styles.content}>
        <p style={styles.eyebrow}>TIME AND ATTENDANCE</p>
        <h1 style={styles.title}>Attendance Management</h1>
        <p style={styles.subtitle}>
          Record your working day and review attendance history.
        </p>

        {error && (
          <div
            role="alert"
            style={{
              ...styles.notice,
              background: "#fef3f2",
              color: "#b42318",
              border: "1px solid #fecdca",
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            style={{
              ...styles.notice,
              background: "#ecfdf3",
              color: "#067647",
              border: "1px solid #abefc6",
            }}
          >
            {message}
          </div>
        )}

        {!isHR && (
          <section style={styles.panel}>
            <h2 style={{ marginTop: 0 }}>Today's attendance</h2>
            <p style={styles.subtitle}>Date: {formatDate(today)}</p>

            <div style={styles.grid}>
              <div style={styles.stat}>
                <span style={styles.statLabel}>Attendance status</span>
                <strong style={styles.statValue}>
                  {todayRecord
                    ? statusLabel(todayRecord.status)
                    : "NOT CHECKED IN"}
                </strong>
              </div>

              <div style={styles.stat}>
                <span style={styles.statLabel}>Check-in time</span>
                <strong style={styles.statValue}>
                  {formatTime(todayRecord?.check_in)}
                </strong>
              </div>

              <div style={styles.stat}>
                <span style={styles.statLabel}>Check-out time</span>
                <strong style={styles.statValue}>
                  {formatTime(todayRecord?.check_out)}
                </strong>
              </div>

              <div style={styles.stat}>
                <span style={styles.statLabel}>Overtime</span>
                <strong style={styles.statValue}>
                  {formatOvertime(todayRecord?.overtime_minutes)}
                </strong>
              </div>
            </div>

            {todayRecord && (
              <p>
                <span
                  style={{
                    ...styles.badge,
                    ...statusColors(todayRecord.status),
                  }}
                >
                  {statusLabel(todayRecord.status)}
                </span>
              </p>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                marginTop: "22px",
              }}
            >
              <button
                style={{
                  ...styles.primaryButton,
                  ...(working || checkedIn || markedAbsent
                    ? styles.disabledButton
                    : {}),
                }}
                disabled={working || checkedIn || markedAbsent}
                onClick={() => handleAttendanceAction("check-in")}
              >
                {working ? "Processing..." : "Check In"}
              </button>

              <button
                style={{
                  ...styles.button,
                  ...(working || !checkedIn || checkedOut || markedAbsent
                    ? styles.disabledButton
                    : {}),
                }}
                disabled={
                  working || !checkedIn || checkedOut || markedAbsent
                }
                onClick={() => handleAttendanceAction("check-out")}
              >
                Check Out
              </button>

              <button
                style={styles.button}
                onClick={loadAttendance}
                disabled={loading || working}
              >
                ↻ Refresh
              </button>
            </div>

            {todayRecord?.status === "PRESENT" && (
              <p style={{ color: "#067647", marginBottom: 0 }}>
                You checked in on time.
              </p>
            )}

            {todayRecord?.status === "LATE" && (
              <p style={{ color: "#b54708", marginBottom: 0 }}>
                Your check-in was after the configured work start time.
              </p>
            )}

            {markedAbsent && (
              <p style={{ color: "#b42318", marginBottom: 0 }}>
                Your attendance has been marked absent for today. Please
                contact HR if you believe this is incorrect.
              </p>
            )}

            {checkedOut && (
              <p style={{ ...styles.subtitle, marginBottom: 0 }}>
                Your attendance for today is complete.
              </p>
            )}
          </section>
        )}

        {isHR && (
          <section style={styles.panel}>
            <h2 style={{ marginTop: 0 }}>Daily attendance summary</h2>

            <label
              htmlFor="attendanceDate"
              style={{
                display: "block",
                margin: "16px 0 8px",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Select attendance date
            </label>

            <input
              id="attendanceDate"
              type="date"
              value={selectedDate}
              max={today}
              onChange={(event) => setSelectedDate(event.target.value)}
              style={styles.input}
            />

            <div style={styles.grid}>
              <div style={styles.stat}>
                <span style={styles.statLabel}>Total records</span>
                <strong style={styles.statValue}>
                  {summary?.total_days ?? "—"}
                </strong>
              </div>

              <div style={styles.stat}>
                <span style={styles.statLabel}>Present</span>
                <strong style={styles.statValue}>
                  {summary?.present_days ?? "—"}
                </strong>
              </div>

              <div style={styles.stat}>
                <span style={styles.statLabel}>Late</span>
                <strong style={styles.statValue}>
                  {summary?.late_days ?? "—"}
                </strong>
              </div>

              <div style={styles.stat}>
                <span style={styles.statLabel}>Absent</span>
                <strong style={styles.statValue}>
                  {summary?.absent_days ?? "—"}
                </strong>
              </div>

              <div style={styles.stat}>
                <span style={styles.statLabel}>Checked out</span>
                <strong style={styles.statValue}>
                  {summary?.checked_out_days ?? "—"}
                </strong>
              </div>

              <div style={styles.stat}>
                <span style={styles.statLabel}>Total overtime</span>
                <strong style={styles.statValue}>
                  {formatOvertime(summary?.overtime_minutes)}
                </strong>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                marginTop: "22px",
              }}
            >
              <button
                style={styles.button}
                onClick={loadAttendance}
                disabled={loading || working}
              >
                ↻ Refresh
              </button>

              <button
                style={{
                  ...styles.dangerButton,
                  ...(working || loading ? styles.disabledButton : {}),
                }}
                onClick={handleMarkAbsent}
                disabled={working || loading || !selectedDate}
              >
                {working ? "Processing..." : "Mark Absent"}
              </button>
            </div>

            <p style={styles.subtitle}>
              Mark Absent creates records only for active employees who have
              no attendance record for the selected date. For today, this
              action is available after 6:00 PM India time. It is a manual
              action, not an automatic scheduled process.
            </p>
          </section>
        )}

        <section style={styles.panel}>
          <h2 style={{ marginTop: 0 }}>
            {isHR ? "Attendance records" : "My attendance history"}
          </h2>

          {loading ? (
            <p style={styles.subtitle}>Loading attendance records...</p>
          ) : records.length === 0 ? (
            <p style={styles.subtitle}>
              No attendance records found for the selected view.
            </p>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {isHR && (
                      <>
                        <th style={styles.cell}>Username</th>
                        <th style={styles.cell}>Email</th>
                      </>
                    )}
                    <th style={styles.cell}>Date</th>
                    <th style={styles.cell}>Check-in</th>
                    <th style={styles.cell}>Check-out</th>
                    <th style={styles.cell}>Status</th>
                    <th style={styles.cell}>Overtime</th>
                  </tr>
                </thead>

                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      {isHR && (
                        <>
                          <td style={styles.cell}>
                            {record.username || `User ${record.user_id}`}
                          </td>
                          <td style={styles.cell}>
                            {record.email || "—"}
                          </td>
                        </>
                      )}

                      <td style={styles.cell}>
                        {formatDate(record.attendance_date)}
                      </td>

                      <td style={styles.cell}>
                        {formatTime(record.check_in)}
                      </td>

                      <td style={styles.cell}>
                        {formatTime(record.check_out)}
                      </td>

                      <td style={styles.cell}>
                        <span
                          style={{
                            ...styles.badge,
                            ...statusColors(record.status),
                          }}
                        >
                          {statusLabel(record.status)}
                        </span>
                      </td>

                      <td style={styles.cell}>
                        {formatOvertime(record.overtime_minutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
