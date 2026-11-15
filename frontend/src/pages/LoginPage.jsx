
import { useState } from "react";
import styles from "../styles";
import { API } from "../constants";

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || "Invalid username or password.");
      }

      if (!data.access_token) {
        throw new Error("Backend did not return an access token.");
      }

      localStorage.setItem("token", data.access_token);

      onLogin({
        username: data.username || form.username,
        token: data.access_token,
      });
    } catch (err) {
      setError(
        err.message || "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.loginWrap}>
      <div className="login-card" style={styles.loginCard}>
        <div style={styles.loginLogo}>💧</div>

        <h1 style={styles.loginTitle}>
          Water Monitoring
        </h1>

        <p style={styles.loginSub}>
          PROJECT: WATER FILTER SYSTEM
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ width: "100%" }}
        >
          <div style={styles.formGroup}>
            <label style={styles.label}>
              USERNAME
            </label>

            <input
              style={styles.input}
              placeholder="Enter username"
              required
              autoComplete="username"
              value={form.username}
              onChange={(e) =>
                setForm({
                  ...form,
                  username: e.target.value,
                })
              }
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              PASSWORD
            </label>

            <input
              style={styles.input}
              type="password"
              placeholder="Enter password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(e) =>
                setForm({
                  ...form,
                  password: e.target.value,
                })
              }
            />
          </div>

          {error && (
            <p
              role="alert"
              style={{
                color: "#ef4444",
                fontSize: "12px",
                marginBottom: "12px",
                textAlign: "center",
              }}
            >
              {error}
            </p>
          )}

          <button
            style={styles.loginBtn}
            disabled={loading}
            type="submit"
          >
            {loading ? "VERIFYING..." : "SIGN IN"}
          </button>
        </form>
      </div>
    </div>
  );
}
