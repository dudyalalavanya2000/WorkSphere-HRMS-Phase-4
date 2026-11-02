import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import axios from "axios";

import EmployeeManagement from "./EmployeeManagement";
import Attendance from "./Attendance";
import LeaveManagement from "./LeaveManagement";
import Payroll from "./Payroll";
import Analytics from "./Analytics";
import Notifications from "./Notifications";
import AdminManagement from "./AdminManagement";
import Performance from "./Performance";
import Training from "./Training";
import Recruitment from "./Recruitment";
import Expenses from "./Expenses";
import Onboarding from "./Onboarding";
import Calendar from "./Calendar";
import Feedback from "./Feedback";
import ProfileSettings from "./ProfileSettings";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const inputStyle = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  fontSize: "15px",
};

const buttonStyle = {
  border: "none",
  borderRadius: "8px",
  padding: "12px 16px",
  background: "#2563eb",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
};

function getRoleFromToken(token) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(base64));
    return decoded.role || decoded.user_role || "";
  } catch {
    return "";
  }
}

function clearLoginData() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_role");
  localStorage.removeItem("username");
}

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body = new URLSearchParams();
      body.append("username", username);
      body.append("password", password);

      const response = await axios.post(
        `${API_URL}/api/v1/auth/login`,
        body,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const token = response.data.access_token;

      if (!token) {
        throw new Error("Login response did not contain an access token.");
      }

      localStorage.setItem("access_token", token);
      const tokenRole = getRoleFromToken(token);

      try {
        const userResponse = await axios.get(
          `${API_URL}/api/v1/auth/me`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const user = userResponse.data;
        const role = user.role?.value || user.role || tokenRole;

        localStorage.setItem("user_role", String(role).toUpperCase());
        localStorage.setItem("username", user.username || username);
      } catch {
        localStorage.setItem(
          "user_role",
          String(tokenRole).toUpperCase()
        );
        localStorage.setItem("username", username);
      }

      navigate("/dashboard");
    } catch (err) {
      clearLoginData();
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#f1f5f9",
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          width: "100%",
          maxWidth: "420px",
          boxSizing: "border-box",
          padding: "32px",
          borderRadius: "16px",
          background: "#ffffff",
          boxShadow: "0 8px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <h1 style={{ margin: "0 0 8px", color: "#1d4ed8" }}>
          WorkSphere
        </h1>
        <h2 style={{ margin: "0 0 8px" }}>Welcome Back</h2>
        <p style={{ color: "#64748b", marginBottom: "24px" }}>
          Sign in to your HR Management System.
        </p>

        <label
          htmlFor="username"
          style={{ display: "block", marginBottom: "6px" }}
        >
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
          style={inputStyle}
        />

        <label
          htmlFor="password"
          style={{ display: "block", margin: "16px 0 6px" }}
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          style={inputStyle}
        />

        {error && (
          <p
            role="alert"
            style={{
              color: "#b91c1c",
              background: "#fef2f2",
              padding: "10px",
              borderRadius: "8px",
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            ...buttonStyle,
            width: "100%",
            marginTop: "22px",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
    </main>
  );
}

function DashboardCard({ title, value }) {
  return (
    <div
      style={{
        padding: "20px",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
      }}
    >
      <p style={{ color: "#64748b", marginTop: 0 }}>{title}</p>
      <h2 style={{ marginBottom: 0 }}>{value}</h2>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("access_token");
  const role = (localStorage.getItem("user_role") || "").toUpperCase();
  const username = localStorage.getItem("username") || "User";

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const response = await axios.get(
          `${API_URL}/api/v1/dashboard/me`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!cancelled) setDashboard(response.data);
      } catch (err) {
        if (cancelled) return;

        if (err.response?.status === 401) {
          clearLoginData();
          navigate("/");
        } else {
          setError(
            err.response?.data?.detail ||
              "Could not load your dashboard."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  function logout() {
    clearLoginData();
    navigate("/");
  }

  const cards = [
    {
      title: "Employee Management",
      description: "View employee details and manage profiles.",
      path: "/employees",
    },
    {
      title: "Attendance",
      description: "Check attendance and review daily records.",
      path: "/attendance",
    },
    {
      title: "Leave Management",
      description: "Apply for leave or review leave requests.",
      path: "/leaves",
    },
    {
      title: "Payroll",
      description: "View salary records and payment status.",
      path: "/payroll",
    },
    {
      title: "Notifications",
      description: "View updates and manage unread notifications.",
      path: "/notifications",
    },
    {
      title: "Performance Management",
      description: "View performance reviews, ratings, and feedback.",
      path: "/performance",
    },
    {
      title: "Training & Development",
      description: "Browse training programs and track learning progress.",
      path: "/training",
    },
    {
      title: "Recruitment & Onboarding",
      description:
        "Browse vacancies, review applications, and manage onboarding.",
      path: "/recruitment",
    },
    {
      title: "Employee Onboarding",
      description:
        "Assign onboarding tasks, complete checklists, and track employee progress.",
      path: "/onboarding",
    },
    {
      title: "Expense & Reimbursement",
      description:
        "Submit expense claims, review requests, and track reimbursements.",
      path: "/expenses",
    },
    {
      title: "Google Calendar",
      description:
        "Connect Google Calendar and synchronize approved employee leaves.",
      path: "/calendar",
    },
    {
      title: "Employee Feedback",
      description:
        "Submit suggestions, track feedback, and review employee responses.",
      path: "/feedback",
    },
    {
      title: "Profile & Settings",
      description:
        "View your profile, update personal details, and change your password.",
      path: "/profile-settings",
    },
    ...(role === "HR" || role === "ADMIN"
      ? [
          {
            title: "Analytics",
            description:
              "Review workforce, attendance, leave and payroll statistics.",
            path: "/analytics",
          },
        ]
      : []),
    ...(role === "ADMIN"
      ? [
          {
            title: "Admin Management",
            description: "View registered users and manage their roles.",
            path: "/admin",
          },
        ]
      : []),
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#1e293b",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          padding: "18px 5%",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <Link
          to="/dashboard"
          style={{
            color: "#1d4ed8",
            fontSize: "23px",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          WorkSphere
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <span>
            {username} · <strong>{role || "USER"}</strong>
          </span>
          <button type="button" onClick={logout} style={buttonStyle}>
            Logout
          </button>
        </div>
      </header>

      <section
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "30px 20px",
        }}
      >
        <h1 style={{ marginBottom: "8px" }}>Dashboard</h1>
        <p style={{ color: "#64748b" }}>
          Welcome back, {dashboard?.username || username}!
        </p>

        {loading && <p>Loading your dashboard...</p>}
        {error && (
          <p role="alert" style={{ color: "#b91c1c" }}>
            {error}
          </p>
        )}

        {dashboard && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "16px",
              margin: "24px 0",
            }}
          >
            <DashboardCard
              title="Today's Attendance"
              value={dashboard.attendance?.status || "Not marked"}
            />
            <DashboardCard
              title="Pending Leaves"
              value={dashboard.leave_requests?.PENDING ?? 0}
            />
            <DashboardCard
              title="Approved Leaves"
              value={dashboard.leave_requests?.APPROVED ?? 0}
            />
            <DashboardCard
              title="Latest Net Salary"
              value={
                dashboard.payroll?.latest_net_salary == null
                  ? "Not available"
                  : `₹${Number(
                      dashboard.payroll.latest_net_salary
                    ).toLocaleString("en-IN")}`
              }
            />
          </div>
        )}

        <h2 style={{ margin: "30px 0 16px" }}>HRMS Modules</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "18px",
          }}
        >
          {cards.map((card) => (
            <button
              key={card.path}
              type="button"
              onClick={() => navigate(card.path)}
              style={{
                textAlign: "left",
                padding: "24px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                cursor: "pointer",
                color: "#1e293b",
              }}
            >
              <h3 style={{ margin: "0 0 10px", color: "#1d4ed8" }}>
                {card.title}
              </h3>
              <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
                {card.description}
              </p>
              <p style={{ marginBottom: 0, fontWeight: 600 }}>
                Open module →
              </p>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function ProtectedRoute({ children }) {
  if (!localStorage.getItem("access_token")) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function ProtectedAnalytics() {
  const token = localStorage.getItem("access_token");
  const role = (localStorage.getItem("user_role") || "").toUpperCase();

  if (!token) return <Navigate to="/" replace />;
  if (role !== "HR" && role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Analytics />;
}

function ProtectedAdmin() {
  const token = localStorage.getItem("access_token");
  const role = (localStorage.getItem("user_role") || "").toUpperCase();

  if (!token) return <Navigate to="/" replace />;
  if (role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  return <AdminManagement />;
}

function ProtectedPerformance() {
  if (!localStorage.getItem("access_token")) {
    return <Navigate to="/" replace />;
  }

  return <Performance />;
}

function ProtectedTraining() {
  if (!localStorage.getItem("access_token")) {
    return <Navigate to="/" replace />;
  }

  return <Training />;
}

function ProtectedRecruitment() {
  if (!localStorage.getItem("access_token")) {
    return <Navigate to="/" replace />;
  }

  return <Recruitment />;
}

function ProtectedExpenses() {
  if (!localStorage.getItem("access_token")) {
    return <Navigate to="/" replace />;
  }

  return <Expenses />;
}

function ProtectedOnboarding() {
  if (!localStorage.getItem("access_token")) {
    return <Navigate to="/" replace />;
  }

  return <Onboarding />;
}

function ProtectedCalendar() {
  if (!localStorage.getItem("access_token")) {
    return <Navigate to="/" replace />;
  }

  return <Calendar />;
}

function ProtectedFeedback() {
  if (!localStorage.getItem("access_token")) {
    return <Navigate to="/" replace />;
  }

  return <Feedback />;
}

function ProtectedProfileSettings() {
  if (!localStorage.getItem("access_token")) {
    return <Navigate to="/" replace />;
  }

  return <ProfileSettings />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/employees"
        element={
          <ProtectedRoute>
            <EmployeeManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <Attendance />
          </ProtectedRoute>
        }
      />

      <Route
        path="/leaves"
        element={
          <ProtectedRoute>
            <LeaveManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/payroll"
        element={
          <ProtectedRoute>
            <Payroll />
          </ProtectedRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        }
      />

      <Route path="/performance" element={<ProtectedPerformance />} />
      <Route path="/training" element={<ProtectedTraining />} />
      <Route path="/recruitment" element={<ProtectedRecruitment />} />
      <Route path="/expenses" element={<ProtectedExpenses />} />
      <Route path="/onboarding" element={<ProtectedOnboarding />} />
      <Route path="/calendar" element={<ProtectedCalendar />} />
      <Route path="/feedback" element={<ProtectedFeedback />} />
      <Route
        path="/profile-settings"
        element={<ProtectedProfileSettings />}
      />

      <Route path="/analytics" element={<ProtectedAnalytics />} />
      <Route path="/admin" element={<ProtectedAdmin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}