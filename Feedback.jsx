
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "./Feedback.css";

const API_URL = "http://127.0.0.1:8000";

const categories = [
  "WORKPLACE",
  "MANAGEMENT",
  "TEAM",
  "POLICY",
  "OTHER",
];

function getHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("access_token")}`,
  };
}

function getReviewStatus(item, values) {
  if (values.status) {
    return values.status;
  }

  // SUBMITTED is the initial status, not a valid HR review status.
  return item.status === "SUBMITTED" ? "IN_REVIEW" : item.status;
}

export default function Feedback() {
  const role = (localStorage.getItem("user_role") || "").toUpperCase();
  const isHR = role === "HR" || role === "ADMIN";

  const [feedback, setFeedback] = useState([]);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("WORKPLACE");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reviewValues, setReviewValues] = useState({});

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const endpoint = isHR
        ? `${API_URL}/api/v1/feedback/`
        : `${API_URL}/api/v1/feedback/me`;

      const response = await axios.get(endpoint, {
        headers: getHeaders(),
      });

      setFeedback(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to load feedback."
      );
    } finally {
      setLoading(false);
    }
  }, [isHR]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  async function submitFeedback(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await axios.post(
        `${API_URL}/api/v1/feedback/`,
        { subject, category, message },
        { headers: getHeaders() }
      );

      setSubject("");
      setCategory("WORKPLACE");
      setMessage("");
      setSuccess("Your feedback was submitted successfully.");

      await loadFeedback();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to submit feedback."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function updateReviewField(id, field, value) {
    setReviewValues((previous) => ({
      ...previous,
      [id]: {
        ...previous[id],
        [field]: value,
      },
    }));
  }

  async function reviewFeedback(item) {
    const values = reviewValues[item.id] || {};
    const status = getReviewStatus(item, values);

    const hr_response =
      values.hr_response !== undefined
        ? values.hr_response
        : item.hr_response || null;

    setError("");
    setSuccess("");

    try {
      await axios.patch(
        `${API_URL}/api/v1/feedback/${item.id}/review`,
        { status, hr_response },
        { headers: getHeaders() }
      );

      setSuccess(`Feedback #${item.id} was updated successfully.`);
      await loadFeedback();

      setReviewValues((previous) => {
        const updated = { ...previous };
        delete updated[item.id];
        return updated;
      });
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to update feedback."
      );
    }
  }

  return (
    <main className="feedback-page">
      <header className="feedback-header">
        <div>
          <h1>Employee Feedback</h1>
          <p>
            {isHR
              ? "Review employee feedback and respond to submissions."
              : "Share your suggestions and track your feedback."}
          </p>
        </div>

        <Link className="feedback-back" to="/dashboard">
          Back to Dashboard
        </Link>
      </header>

      {error && <div className="feedback-alert error">{error}</div>}

      {success && (
        <div className="feedback-alert success">{success}</div>
      )}

      {!isHR && (
        <section className="feedback-panel">
          <h2>Submit Feedback</h2>

          <form onSubmit={submitFeedback}>
            <label htmlFor="feedback-subject">Subject</label>
            <input
              id="feedback-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              minLength={3}
              maxLength={200}
              required
              placeholder="Enter feedback subject"
            />

            <label htmlFor="feedback-category">Category</label>
            <select
              id="feedback-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item.replace("_", " ")}
                </option>
              ))}
            </select>

            <label htmlFor="feedback-message">Your Feedback</label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              minLength={10}
              maxLength={3000}
              required
              rows={5}
              placeholder="Share your feedback or suggestion..."
            />

            <button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </form>
        </section>
      )}

      <section className="feedback-panel">
        <div className="feedback-list-heading">
          <h2>
            {isHR ? "All Employee Feedback" : "My Feedback History"}
          </h2>

          <button
            className="feedback-refresh"
            type="button"
            onClick={loadFeedback}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p>Loading feedback...</p>
        ) : feedback.length === 0 ? (
          <p className="feedback-empty">No feedback found.</p>
        ) : (
          <div className="feedback-list">
            {feedback.map((item) => {
              const values = reviewValues[item.id] || {};

              return (
                <article className="feedback-item" key={item.id}>
                  <div className="feedback-item-top">
                    <div>
                      <h3>{item.subject}</h3>

                      <p className="feedback-meta">
                        Feedback #{item.id} · {item.category}
                        {isHR && ` · Employee ID: ${item.employee_id}`}
                      </p>
                    </div>

                    <span
                      className={`feedback-status ${item.status.toLowerCase()}`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </div>

                  <p className="feedback-message">{item.message}</p>

                  <p className="feedback-meta">
                    Submitted:{" "}
                    {new Date(item.created_at).toLocaleString("en-IN")}
                  </p>

                  {item.hr_response && (
                    <div className="feedback-response">
                      <strong>HR Response</strong>
                      <p>{item.hr_response}</p>
                    </div>
                  )}

                  {isHR && (
                    <div className="feedback-review">
                      <label htmlFor={`status-${item.id}`}>
                        Update Status
                      </label>

                      <select
                        id={`status-${item.id}`}
                        value={getReviewStatus(item, values)}
                        onChange={(event) =>
                          updateReviewField(
                            item.id,
                            "status",
                            event.target.value
                          )
                        }
                      >
                        <option value="IN_REVIEW">IN REVIEW</option>
                        <option value="RESOLVED">RESOLVED</option>
                      </select>

                      <label htmlFor={`response-${item.id}`}>
                        HR Response
                      </label>

                      <textarea
                        id={`response-${item.id}`}
                        rows={3}
                        maxLength={3000}
                        value={
                          values.hr_response !== undefined
                            ? values.hr_response
                            : item.hr_response || ""
                        }
                        onChange={(event) =>
                          updateReviewField(
                            item.id,
                            "hr_response",
                            event.target.value
                          )
                        }
                        placeholder="Write a response to the employee..."
                      />

                      <button
                        type="button"
                        onClick={() => reviewFeedback(item)}
                      >
                        Save Review
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
