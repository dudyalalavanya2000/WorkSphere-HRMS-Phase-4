
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const API_URL = "http://127.0.0.1:8000";

const initialForm = {
  employee_id: "",
  review_period: "Q3 2026",
  rating: "4",
  strengths: "",
  areas_for_improvement: "",
  feedback: "",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  fontSize: "14px",
  marginTop: "6px",
};

const buttonStyle = {
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 600,
  cursor: "pointer",
};

function getErrorMessage(error) {
  const detail = error.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(", ");
  }

  return detail || error.message || "Something went wrong.";
}

export default function Performance() {
  const token = localStorage.getItem("access_token");
  const role = (localStorage.getItem("user_role") || "").toUpperCase();
  const isManager = role === "HR" || role === "ADMIN";
  const isAdmin = role === "ADMIN";

  const [reviews, setReviews] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const api = useCallback(
    () =>
      axios.create({
        baseURL: API_URL,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const client = api();
      const response = await client.get(
        isManager ? "/api/v1/performance/" : "/api/v1/performance/me"
      );

      setReviews(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [api, isManager]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  function startEditing(review) {
    setEditingId(review.id);
    setForm({
      employee_id: String(review.employee_id),
      review_period: review.review_period,
      rating: String(review.rating),
      strengths: review.strengths,
      areas_for_improvement: review.areas_for_improvement,
      feedback: review.feedback,
    });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      review_period: form.review_period.trim(),
      rating: Number(form.rating),
      strengths: form.strengths.trim(),
      areas_for_improvement: form.areas_for_improvement.trim(),
      feedback: form.feedback.trim(),
    };

    try {
      const client = api();

      if (editingId !== null) {
        await client.patch(`/api/v1/performance/${editingId}`, payload);
        setMessage("Performance review updated successfully.");
      } else {
        await client.post("/api/v1/performance/", {
          ...payload,
          employee_id: Number(form.employee_id),
        });
        setMessage("Performance review created successfully.");
      }

      resetForm();
      await loadReviews();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(reviewId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this performance review?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await api().delete(`/api/v1/performance/${reviewId}`);
      setMessage("Performance review deleted successfully.");
      await loadReviews();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#1e293b",
        padding: "28px 20px",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <Link
          to="/dashboard"
          style={{
            color: "#2563eb",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ← Back to Dashboard
        </Link>

        <header style={{ margin: "24px 0" }}>
          <h1 style={{ marginBottom: "8px" }}>Performance Management</h1>
          <p style={{ color: "#64748b", marginTop: 0 }}>
            {isManager
              ? "Create, review, and manage employee performance evaluations."
              : "View your performance ratings and review feedback."}
          </p>
        </header>

        {error && (
          <div
            role="alert"
            style={{
              padding: "12px",
              marginBottom: "16px",
              background: "#fef2f2",
              color: "#b91c1c",
              borderRadius: "8px",
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            style={{
              padding: "12px",
              marginBottom: "16px",
              background: "#eff6ff",
              color: "#1d4ed8",
              borderRadius: "8px",
            }}
          >
            {message}
          </div>
        )}

        {isManager && (
          <section
            style={{
              background: "#ffffff",
              padding: "24px",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              marginBottom: "28px",
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              {editingId !== null ? "Edit Performance Review" : "Create Performance Review"}
            </h2>

            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                }}
              >
                {editingId === null && (
                  <label>
                    Employee User ID
                    <input
                      name="employee_id"
                      type="number"
                      min="1"
                      required
                      value={form.employee_id}
                      onChange={updateField}
                      style={inputStyle}
                    />
                  </label>
                )}

                <label>
                  Review Period
                  <input
                    name="review_period"
                    required
                    maxLength={30}
                    placeholder="e.g. Q3 2026"
                    value={form.review_period}
                    onChange={updateField}
                    style={inputStyle}
                  />
                </label>

                <label>
                  Rating (1–5)
                  <select
                    name="rating"
                    required
                    value={form.rating}
                    onChange={updateField}
                    style={inputStyle}
                  >
                    <option value="1">1 - Needs significant improvement</option>
                    <option value="2">2 - Needs improvement</option>
                    <option value="3">3 - Meets expectations</option>
                    <option value="4">4 - Exceeds expectations</option>
                    <option value="5">5 - Outstanding</option>
                  </select>
                </label>
              </div>

              <label style={{ display: "block", marginTop: "16px" }}>
                Strengths
                <textarea
                  name="strengths"
                  required
                  maxLength={1000}
                  rows={3}
                  value={form.strengths}
                  onChange={updateField}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "block", marginTop: "16px" }}>
                Areas for Improvement
                <textarea
                  name="areas_for_improvement"
                  required
                  maxLength={1000}
                  rows={3}
                  value={form.areas_for_improvement}
                  onChange={updateField}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "block", marginTop: "16px" }}>
                Feedback
                <textarea
                  name="feedback"
                  required
                  maxLength={2000}
                  rows={4}
                  value={form.feedback}
                  onChange={updateField}
                  style={inputStyle}
                />
              </label>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginTop: "18px",
                }}
              >
                <button type="submit" disabled={saving} style={buttonStyle}>
                  {saving
                    ? "Saving..."
                    : editingId !== null
                      ? "Save Changes"
                      : "Create Review"}
                </button>

                {editingId !== null && (
                  <button
                    type="button"
                    onClick={resetForm}
                    style={{
                      ...buttonStyle,
                      background: "#64748b",
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h2>Review History</h2>
            <button
              type="button"
              onClick={loadReviews}
              disabled={loading}
              style={buttonStyle}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p>Loading performance reviews...</p>
          ) : reviews.length === 0 ? (
            <div
              style={{
                background: "#ffffff",
                padding: "24px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              No performance reviews found.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {reviews.map((review) => (
                <article
                  key={review.id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "22px",
                    overflowWrap: "anywhere",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <h3 style={{ margin: "0 0 8px" }}>
                        {review.review_period}
                      </h3>
                      <p style={{ color: "#64748b", margin: 0 }}>
                        Review ID: {review.id}
                        {isManager ? ` · Employee ID: ${review.employee_id}` : ""}
                      </p>
                    </div>

                    <div
                      style={{
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        fontWeight: 700,
                      }}
                    >
                      {review.rating}/5 ★
                    </div>
                  </div>

                  <p>
                    <strong>Status:</strong> {review.status}
                  </p>
                  <p>
                    <strong>Strengths:</strong> {review.strengths}
                  </p>
                  <p>
                    <strong>Areas for Improvement:</strong>{" "}
                    {review.areas_for_improvement}
                  </p>
                  <p>
                    <strong>Feedback:</strong> {review.feedback}
                  </p>
                  <p style={{ color: "#64748b", fontSize: "13px" }}>
                    Reviewer ID: {review.reviewer_id}
                    {review.created_at
                      ? ` · Created: ${new Date(review.created_at).toLocaleDateString()}`
                      : ""}
                  </p>

                  {isManager && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                        marginTop: "16px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => startEditing(review)}
                        style={buttonStyle}
                      >
                        Edit Review
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDelete(review.id)}
                          style={{
                            ...buttonStyle,
                            background: "#dc2626",
                          }}
                        >
                          Delete Review
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
