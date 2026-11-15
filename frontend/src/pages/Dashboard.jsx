import { apiFetch } from "../api";
import React, { useState, useEffect } from "react";
import styles from "../styles";
import { API } from "../constants";
import WebTankCard from "../components/WebTankCard";
import WebValveButton from "../components/WebValveButton";
import WebAlertBadge from "../components/WebAlertBadge";
import WebMiniChart from "../components/WebMiniChart";
import WebScheduleRow from "../components/WebScheduleRow";

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState(localStorage.getItem('activeTab') || 'overview');
  const [status, setStatus] = useState(null);
const [schedules, setSchedules] = useState([]);
const [history, setHistory] = useState([]);
const [historyFilter, setHistoryFilter] = useState("ALL");

  // State for Graph Data 
  const [chartData, setChartData] = useState({
  labels: [],
  inflow: [],
  filter: [],
});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // SCHEDULE STATES 
  const [showModal, setShowModal] = useState(false);
  const [openTimeDropdown, setOpenTimeDropdown] = useState(null);
  const [timeInputText, setTimeInputText] = useState({
  start: "",
  end: "",
});
  const [editingId, setEditingId] = useState(null); 
  const [formData, setFormData] = useState({ label: "", start_time: "08:00", end_time: "12:00" });
  const [scheduleToToggle, setScheduleToToggle] = useState(null);
  const [valveToAuto, setValveToAuto] = useState(null);
    const loadActivityHistory = async () => {
    try {
      const [valveRecords, alertRecords] = await Promise.all([
        apiFetch("/api/history/valves"),
        apiFetch("/api/history/alerts"),
      ]);

      const valveLogs = valveRecords.map((record) => {
        const date = new Date(record.timestamp);
        const validDate = !Number.isNaN(date.getTime());

        return {
          id: `VALVE-${record.id}`,
          logType: "VALVE",
          event: `SV${record.valve_id} ${String(record.action).toUpperCase()} command`,
          user: record.issued_by_id
            ? `User ID ${record.issued_by_id}`
            : "—",
          status: record.executed ? "EXECUTED" : "PENDING",
          ackBy: "—",
          time: validDate
            ? date.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })
            : "—",
          timestamp: validDate ? date.toLocaleString() : record.timestamp,
          sortTimestamp: validDate ? date.getTime() : 0,
          type: record.executed ? "success" : "warning",
        };
      });

      const alertLogs = alertRecords.map((record) => {
        const date = new Date(record.timestamp);
        const validDate = !Number.isNaN(date.getTime());
        const severity = String(record.severity || "").toUpperCase();

        return {
          id: `ALERT-${record.id}`,
          logType: "ALERT",
          event: record.message,
          user: "System",
          status: record.acknowledged
            ? "ACKNOWLEDGED"
            : record.active
            ? "ACTIVE"
            : "RESOLVED",
          ackBy: record.acknowledged_by || "—",
          time: validDate
            ? date.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })
            : "—",
          timestamp: validDate ? date.toLocaleString() : record.timestamp,
          sortTimestamp: validDate ? date.getTime() : 0,
          type:
            severity === "CRITICAL"
              ? "danger"
              : severity === "WARNING"
              ? "warning"
              : "success",
        };
      });

      setHistory(
        [...valveLogs, ...alertLogs].sort(
          (a, b) => b.sortTimestamp - a.sortTimestamp
        )
      );
    } catch (error) {
      console.error("Activity history loading failed:", error);
    }
  };

  useEffect(() => {
  let cancelled = false;

  const loadDashboard = async () => {
    setLoading(true);
    setLoadError("");

    try {
      // Load actual dashboard data
      const dashboard = await apiFetch("/api/dashboard");

      if (cancelled) return;

      if (dashboard.status) {
        setStatus({
          ...dashboard.status,
          valves:
            dashboard.valve_states ??
            dashboard.status.valves ??
            {},
        });
      } else {
        setStatus(null);
      }

      setSchedules(dashboard.schedules ?? []);
    } catch (error) {
      if (!cancelled) {
        setLoadError(error.message);
      }
    }

    // Load actual chart history separately
    try {
      const chart = await apiFetch("/api/stats/history");

      if (!cancelled) {
        setChartData({
          labels: chart.labels ?? [],
          inflow: chart.inflow ?? [],
          filter: chart.filter ?? [],
        });
      }
    } catch (error) {
      console.error("Chart data unavailable:", error);
    }

    if (!cancelled) {
  await loadActivityHistory();
  setLoading(false);
}
  };

  loadDashboard();

  return () => {
    cancelled = true;
  };
}, []);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);


  //  HANDLERS
const handleValveToggle = async (id) => {
  const valveKey = `sv${id}`;
  const currentlyOpen = Boolean(status?.valves?.[valveKey]);

  try {
    const response = await apiFetch("/api/valves/command", {
      method: "POST",
      body: JSON.stringify({
        valve_id: id,
        action: currentlyOpen ? "CLOSE" : "OPEN",
        duration_minutes: 30,
      }),
    });

    setStatus((prev) => ({
      ...prev,
      valves: {
        ...prev.valves,
        [valveKey]: response.is_open,
      },
    }));

    console.log(`SV${id} command accepted:`, response);
  } catch (error) {
    console.error(`SV${id} command failed:`, error);
    alert(`Valve command failed: ${error.message}`);
  }
};

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to delete all alert logs?")) return;
    try {
      const res = await fetch(`${API}/api/alerts/clear/`, { // 🚨 Added Trailing Slash
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setHistory([]);
    } catch (e) { alert("Error clearing logs."); }
  };

  const handleClearValveHistory = async () => {
    if (!window.confirm("Database Maintenance: Wipe all Valve Command logs?")) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/valves/clear-history/`, { // 🚨 Added Trailing Slash
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        alert("✅ Valve history successfully wiped from MySQL.");
        fetchData(); 
      } else {
        alert("❌ Error: Endpoint not found. Check urls.py.");
      }
    } catch (e) {
      alert("❌ Connection Error.");
    }
  };

const formatTime12Hour = (time) => {
  if (!time) return "";

  const [hour, minute] = time.substring(0, 5).split(":");
  let h = parseInt(hour, 10);

  const period = h >= 12 ? "PM" : "AM";

  if (h === 0) {
    h = 12;
  } else if (h > 12) {
    h -= 12;
  }

  return `${h}:${minute} ${period}`;
};

 const openModal = (sched = null) => {
  if (sched) {
    setEditingId(sched.id);

    const startTime = sched.start_time.substring(0, 5);
    const endTime = sched.end_time.substring(0, 5);

    setFormData({
      label: sched.label,
      start_time: startTime,
      end_time: endTime,
    });

    setTimeInputText({
      start: formatTime12Hour(startTime),
      end: formatTime12Hour(endTime),
    });
  } else {
    setEditingId(null);

    setFormData({
      label: "",
      start_time: "08:00",
      end_time: "12:00",
    });

    setTimeInputText({
      start: "8:00 AM",
      end: "12:00 PM",
    });
  }

  setOpenTimeDropdown(null);
  setShowModal(true);
};

const convertTimeTo24Hour = (time) => {
  if (!time) return "";

  const parts = time.trim().split(" ");
  const timePart = parts[0];
  const period = parts[1]?.toUpperCase();

  let [hour, minute] = timePart.split(":").map(Number);

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const timeOptions = [];

for (let hour = 0; hour < 24; hour++) {
  const hour24 = String(hour).padStart(2, "0");

  let hour12 = hour % 12;
  if (hour12 === 0) hour12 = 12;

  const period = hour < 12 ? "AM" : "PM";

  timeOptions.push({
    value: `${hour24}:00`,
    label: `${hour12}:00 ${period}`,
  });
}



const handleSaveSchedule = async () => {
  if (!formData.label.trim()) {
    return alert("Add TapStand Name.");
  }

  const startTime24 = convertTimeTo24Hour(timeInputText.start);
  const endTime24 = convertTimeTo24Hour(timeInputText.end);

  if (!startTime24 || !endTime24) {
    return alert("Please enter a valid start and end time.");
  }

  try {
    if (editingId !== null) {
      // EDIT EXISTING SCHEDULE
      const existingSchedule = schedules.find(
        (schedule) => String(schedule.id) === String(editingId)
      );

      if (!existingSchedule) {
        return alert("Schedule not found.");
      }

      const updatedData = {
        label: formData.label.trim(),
        start_time: startTime24,
        end_time: endTime24,
      };

      const response = await apiFetch(
        `/api/schedules/${editingId}`,
        {
          method: "PUT",
          body: JSON.stringify(updatedData),
        }
      );

      setSchedules((prev) =>
        prev.map((schedule) =>
          String(schedule.id) === String(editingId)
            ? {
                ...schedule,
                ...response,
                ...updatedData,
              }
            : schedule
        )
      );

      alert("Schedule updated successfully.");
    } else {
      // CREATE NEW SCHEDULE
      const usedTapStands = new Set(
        schedules.map((schedule) => Number(schedule.tap_stand))
      );

      const nextTapStand = [1, 2, 3, 4, 5].find(
        (number) => !usedTapStands.has(number)
      );

      if (!nextTapStand) {
        return alert("All 5 tap stands already have schedules.");
      }

      const newSchedule = await apiFetch("/api/schedules", {
        method: "POST",
        body: JSON.stringify({
          tap_stand: nextTapStand,
          label: formData.label.trim(),
          start_time: startTime24,
          end_time: endTime24,
          enabled: true,
        }),
      });

      setSchedules((prev) => [...prev, newSchedule]);

      alert("Schedule created successfully.");
    }

    // RESET FORM AFTER SUCCESS
    setShowModal(false);
    setEditingId(null);

    setFormData({
      label: "",
      start_time: "08:00",
      end_time: "12:00",
    });

    setTimeInputText({
      start: "8:00 AM",
      end: "12:00 PM",
    });

    setOpenTimeDropdown(null);

  } catch (error) {
    console.error("Schedule save failed:", error);
    alert(`Schedule save failed: ${error.message}`);
  }
};

const handleDeleteSchedule = async (id) => {
  if (!window.confirm("Are you sure you want to remove this schedule?")) {
    return;
  }

  try {
    await apiFetch(`/api/schedules/${id}`, {
      method: "DELETE",
    });

    setSchedules((prev) =>
      prev.filter((schedule) => String(schedule.id) !== String(id))
    );

    alert("Schedule deleted successfully.");

  } catch (error) {
    console.error("Schedule deletion failed:", error);
    alert(`Schedule deletion failed: ${error.message}`);
  }
};

const confirmToggleSchedule = async () => {
  if (!scheduleToToggle) return;

  const scheduleId = scheduleToToggle.id;
  const newEnabledState = !scheduleToToggle.enabled;

  try {
    await apiFetch(`/api/schedules/${scheduleId}`, {
      method: "PUT",
      body: JSON.stringify({
        enabled: newEnabledState,
      }),
    });

    setSchedules((prev) =>
      prev.map((schedule) =>
        String(schedule.id) === String(scheduleId)
          ? {
              ...schedule,
              enabled: newEnabledState,
            }
          : schedule
      )
    );

    setScheduleToToggle(null);

    alert(
      newEnabledState
        ? "Schedule enabled successfully."
        : "Schedule disabled successfully."
    );

  } catch (error) {
    console.error("Schedule toggle failed:", error);
    alert(`Schedule update failed: ${error.message}`);
  }
};


  if (!status) return <div style={styles.loginWrap}><h2 style={{color:'#3b82f6'}}>Syncing Barangay Water IoT...</h2></div>;

  return (
    <div style={styles.mainContainer}>
      {/* MODAL */}
{showModal && (
  <div style={styles.modalOverlay}>
    <div style={styles.modalContent}>

      <div style={styles.modalHeader}>
        <h3 style={{ margin: 0, fontSize: "18px" }}>
          {editingId ? "Update Distribution" : "New Distribution"}
        </h3>
      </div>

      <div style={styles.modalBody}>

        <span style={styles.timeLabel}>
          TAP STAND DESIGNATION
        </span>

        <input
          style={styles.modalInput}
          placeholder="TapStand Name"
          value={formData.label}
          onChange={(e) =>
            setFormData({
              ...formData,
              label: e.target.value,
            })
          }
        />

        <span style={styles.timeLabel}>
          SUPPLY SCHEDULE
        </span>

        <div style={styles.timePickerRow}>

{/* START TIME */}
<div style={styles.timeBox}>

  <span
    style={{
      fontSize: "9px",
      color: "#475569",
      marginBottom: "5px",
      display: "block",
    }}
  >
    START
  </span>

  <div style={{ position: "relative" }}>

    <div style={styles.timeInputWrapper}>

<input
  type="text"
  style={styles.timeTextInput}
  value={timeInputText.start}
  onChange={(e) => {
    setTimeInputText({
      ...timeInputText,
      start: e.target.value,
    });
  }}
  placeholder="7:00 AM"
/>

      <button
        type="button"
        style={styles.timeDropdownToggle}
        onClick={() =>
          setOpenTimeDropdown(
            openTimeDropdown === "start"
              ? null
              : "start"
          )
        }
      >
        ▼
      </button>

    </div>

    {openTimeDropdown === "start" && (
      <div style={styles.timeDropdownMenu}>

        {timeOptions.map((time) => (
          <button
            key={time.value}
            type="button"
            style={{
              ...styles.timeDropdownOption,
              ...(formData.start_time === time.value
                ? styles.timeDropdownOptionActive
                : {}),
            }}
   onClick={() => {
  setFormData({
    ...formData,
    start_time: time.value,
  });

  setTimeInputText({
    ...timeInputText,
    start: time.label,
  });

  setOpenTimeDropdown(null);
}}
          >
            <span>{time.label}</span>

            {formData.start_time === time.value && (
              <span style={styles.checkMark}>✓</span>
            )}
          </button>
        ))}

      </div>
    )}

  </div>
</div>


{/* END TIME */}
<div style={styles.timeBox}>

  <span
    style={{
      fontSize: "9px",
      color: "#475569",
      marginBottom: "5px",
      display: "block",
    }}
  >
    END
  </span>

  <div style={{ position: "relative" }}>

    <div style={styles.timeInputWrapper}>

<input
  type="text"
  style={styles.timeTextInput}
  value={timeInputText.end}
  onChange={(e) => {
    setTimeInputText({
      ...timeInputText,
      end: e.target.value,
    });
  }}
  placeholder="7:00 PM"
/>

      <button
        type="button"
        style={styles.timeDropdownToggle}
        onClick={() =>
          setOpenTimeDropdown(
            openTimeDropdown === "end"
              ? null
              : "end"
          )
        }
      >
        ▼
      </button>

    </div>

    {openTimeDropdown === "end" && (
      <div style={styles.timeDropdownMenu}>

        {timeOptions.map((time) => (
          <button
            key={time.value}
            type="button"
            style={{
              ...styles.timeDropdownOption,
              ...(formData.end_time === time.value
                ? styles.timeDropdownOptionActive
                : {}),
            }}
 onClick={() => {
  setFormData({
    ...formData,
    end_time: time.value,
  });

  setTimeInputText({
    ...timeInputText,
    end: time.label,
  });

  setOpenTimeDropdown(null);
}}
          >
            <span>{time.label}</span>

            {formData.end_time === time.value && (
              <span style={styles.checkMark}>✓</span>
            )}
          </button>
        ))}

      </div>
    )}

  </div>
</div>

        </div>
      </div>


      <div style={styles.modalActions}>

        <button
          type="button"
          style={styles.btnCancel}
          onClick={() => {
            setShowModal(false);
            setOpenTimeDropdown(null);
          }}
        >
          CANCEL
        </button>

        <button
          type="button"
          style={styles.btnSave}
          onClick={handleSaveSchedule}
        >
          {editingId ? "SAVE CHANGES" : "CREATE"}
        </button>

      </div>

    </div>
  </div>
)}


      {valveToAuto !== null && (
  <div style={styles.modalOverlay}>
    <div
      style={{
        ...styles.modalContent,
        maxWidth: "380px",
      }}
    >
      <div style={styles.modalHeader}>
        <h3
          style={{
            margin: 0,
            fontSize: "18px",
          }}
        >
          ENABLE AUTO MODE?
        </h3>
      </div>

      <div style={styles.modalBody}>
        <p
          style={{
            margin: 0,
            color: "#ffffff",
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          Are you sure you want to enable automatic
          control for{" "}
          <strong>Valve SV{valveToAuto}</strong>?
        </p>

        <p
          style={{
            margin: "12px 0 0",
            color: "#94a3b8",
            fontSize: "12px",
            lineHeight: 1.5,
          }}
        >
          The valve will be controlled automatically
          according to the distribution schedule.
        </p>
      </div>

      <div style={styles.modalActions}>
        <button
          type="button"
          style={styles.btnCancel}
          onClick={() => setValveToAuto(null)}
        >
          CANCEL
        </button>

        <button
          type="button"
          style={{
            ...styles.btnSave,
            color: "#3b82f6",
          }}
          onClick={() => {
            setValveToAuto(null);
          }}
        >
          ENABLE AUTO
        </button>
      </div>
    </div>
  </div>
)}

      {scheduleToToggle && (
  <div style={styles.modalOverlay}>
    <div
      style={{
        ...styles.modalContent,
        maxWidth: "380px",
      }}
    >
      <div style={styles.modalHeader}>
        <h3
          style={{
            margin: 0,
            fontSize: "18px",
          }}
        >
          {scheduleToToggle.enabled
            ? "Disable Schedule?"
            : "Enable Schedule?"}
        </h3>
      </div>

      <div style={styles.modalBody}>
        <p
          style={{
            margin: 0,
            color: "#ffffff",
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          Are you sure you want to{" "}
          {scheduleToToggle.enabled ? "disable" : "enable"}{" "}
          <strong>{scheduleToToggle.label}</strong>?
        </p>

        <p
          style={{
            margin: "12px 0 0",
            color: "#94a3b8",
            fontSize: "12px",
          }}
        >
          Schedule:{" "}
          {scheduleToToggle.start_time.substring(0, 5)} -{" "}
          {scheduleToToggle.end_time.substring(0, 5)}
        </p>
      </div>

      <div style={styles.modalActions}>
        <button
          style={styles.btnCancel}
          onClick={() => setScheduleToToggle(null)}
        >
          CANCEL
        </button>

        <button
          style={{
            ...styles.btnSave,
            color: scheduleToToggle.enabled
              ? "#ef4444"
              : "#3DD06F",
          }}
          onClick={confirmToggleSchedule}
        >
          {scheduleToToggle.enabled ? "DISABLE" : "ENABLE"}
        </button>
      </div>
    </div>
  </div>
)}

     <header className="dashboard-header" style={styles.header}>
  <div>
    <p className="dashboard-admin-tag" style={styles.adminTag}>ADMIN PANEL • LIVE</p>
    <h1 className="dashboard-title" style={styles.title}>Water Monitoring</h1>
  </div>

  <button className="dashboard-logout" onClick={onLogout} style={styles.logoutBtn}>
    LOGOUT
  </button>
</header>

<nav className="dashboard-tabs" style={styles.tabBar}>
    {[
    { key: 'overview', label: 'Overview' },
    { key: 'valves', label: 'Valves' },
    { key: 'schedules', label: 'Schedules' },
    { key: 'history', label: 'History' },
  ].map(({ key, label }) => (
    <button
      key={key}
      onClick={() => setActiveTab(key)}
      className="dashboard-tab"
style={{
  ...styles.tab,
        ...(activeTab === key ? styles.tabActive : {}),
      }}
    >
      {label}
    </button>
  ))}
</nav>

      <main className="dashboard-content" style={styles.content}>
        {activeTab === 'overview' && (
         <div className="dashboard-grid" style={styles.dashboardGrid}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
             {(() => {
 const t1 = Math.min(
  100,
  Math.max(0, ((status?.tank1?.level ?? 0) / 1500) * 100)
);

const t2 = Math.min(
  100,
  Math.max(0, ((status?.tank2?.level ?? 0) / 1200) * 100)
);

const t3 = Math.min(
  100,
  Math.max(0, ((status?.tank3?.level ?? 0) / 3000) * 100)
);

  const tanks = [
    { name: "Tank 1", pct: t1 },
    { name: "Tank 2", pct: t2 },
    { name: "Tank 3", pct: t3 },
  ];

  const criticalTank = tanks.find((tank) => tank.pct < 20);
  const warningTank = tanks.find(
    (tank) => tank.pct >= 20 && tank.pct < 40
  );

 if (criticalTank) {
  return (
    <WebAlertBadge
      message={`CRITICAL: ${criticalTank.name} is very low (${criticalTank.pct}%)`}
      type="critical"
    />
  );
}

if (warningTank) {
  return (
    <WebAlertBadge
      message={`WARNING: ${warningTank.name} water level is low (${warningTank.pct}%)`}
      type="warning"
    />
  );
}

return (
  <WebAlertBadge
    message="System Nominal: All water tanks are stable"
    type="info"
  />
);
})()}
              <div>
                <p style={styles.sectionHead}>Tank Analysis</p>
              <div className="tank-row" style={styles.tankRow}>
                   <WebTankCard
                    name="Tank 1"
                    level={status.tank1?.level}
                    capacity={2000}
                  />

                  <WebTankCard
                    name="Tank 2"
                    level={status.tank2?.level}
                    capacity={2000}
                  />

                  <WebTankCard
                    name="Tank 3"
                    level={status.tank3?.level}
                    capacity={4000}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
  style={{
    ...styles.card,
    padding: "16px",
    borderRadius: "14px",
  }}
>
  <p
    style={{
      ...styles.sectionHead,
      fontSize: "10px",
      marginBottom: "12px",
    }}
  >
    SYSTEM INFORMATION
  </p>

  {/* Inflow + Filter */}
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "12px",
    }}
  >
    <div>
      <p
        style={{
          fontSize: "8px",
          color: "#94a3b8",
          margin: "0 0 3px",
        }}
      >
        Inflow
      </p>

      <p
        style={{
          fontSize: "13px",
          fontWeight: "700",
          color: "#ffffff",
          margin: 0,
        }}
      >
        {status.inflow_rate}{" "}
        <span style={{ fontSize: "8px" }}>L/m</span>
      </p>
    </div>

    <div>
      <p
        style={{
          fontSize: "8px",
          color: "#94a3b8",
          margin: "0 0 3px",
        }}
      >
        Filter
      </p>

      <p
        style={{
          fontSize: "13px",
          fontWeight: "700",
          color: "#7dd3fc",
          margin: 0,
        }}
      >
        {status.filter_rate}{" "}
        <span style={{ fontSize: "8px" }}>L/m</span>
      </p>
    </div>
  </div>

  {/* Battery + Solar */}
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "12px",
      marginTop: "10px",
    }}
  >
    <div>
      <p
        style={{
          fontSize: "8px",
          color: "#94a3b8",
          margin: "0 0 3px",
        }}
      >
        Battery Level
      </p>

      <p
        style={{
          fontSize: "13px",
          fontWeight: "700",
          color: "#ffffff",
          margin: 0,
        }}
      >
        {status.battery_level}%
      </p>
    </div>

    <div>
      <p
        style={{
          fontSize: "8px",
          color: "#94a3b8",
          margin: "0 0 3px",
        }}
      >
        Solar Charging Status
      </p>

      <p
        style={{
          fontSize: "11px",
          fontWeight: "700",
          color:
            status.solar_charging_status === "Active"
              ? "#22c55e"
              : "#ef4444",
          margin: 0,
        }}
      >
        {status.solar_charging_status}
      </p>
    </div>
  </div>

  {/* LoRa FMU */}
  <div style={{ marginTop: "10px" }}>
    <p
      style={{
        fontSize: "8px",
        color: "#94a3b8",
        margin: "0 0 3px",
      }}
    >
      LoRa FMU Status
    </p>

    <p
      style={{
        fontSize: "11px",
        fontWeight: "700",
        color:
          status.lora_fmu_status === "Connected"
            ? "#22c55e"
            : "#ef4444",
        margin: 0,
      }}
    >
      {status.lora_fmu_status}
    </p>
  </div>
              </div>

              <div style={styles.card}>
                <p style={styles.sectionHead}>Trend Analytics</p>
                <div style={{ height: '300px' }}>
                   <WebMiniChart history={chartData} /> 
                </div>
              </div>
            </div>
          </div>
        )}

{activeTab === 'valves' && (
  <div>
    <h2
  className="valve-heading"
  style={{
    margin: "0 0 30px",
    color: "#AEB7C7",
    fontSize: "20px",
      }}
    >
      VALVE MONITORING & CONTROL INTERFACE
    </h2>

  <div
  className="valve-grid"
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "20px",
  }}
>
      {[
        { id: 0, connection: "LoRa", commandConfirmed: true },
        { id: 1, connection: "LoRa", commandConfirmed: true },
        { id: 2, connection: "LoRa", commandConfirmed: false },
        { id: 3, connection: "LoRa", commandConfirmed: true },
        { id: 4, connection: "Nano", commandConfirmed: true },
        { id: 5, connection: "Nano", commandConfirmed: false },
      ].map(({ id, connection, commandConfirmed }) => (
        <WebValveButton
          key={id}
          label={`Valve SV${id}`}
          isOpen={status.valves?.[`sv${id}`]}
          onToggle={() => handleValveToggle(id)}
          onAuto={() => setValveToAuto(id)}
          connection={connection}
          commandConfirmed={commandConfirmed}
        />
      ))}
    </div>
  </div>
)}

 {activeTab === "schedules" && (
  <div>
    {/* Schedule Header */}
   <div
  className="schedule-header"
  style={{
    ...styles.schedHeaderRow,
    marginBottom: "30px",
  }}
>
    
      <p
  className="schedule-heading"
  style={{
    ...styles.sectionHead,
          fontSize: "20px",
          color: "#AEB7C7",
          margin: 0,
        }}
      >
        DISTRIBUTION SCHEDULES
      </p>

      <button
        style={{
          ...styles.plusBtn,
          padding: "12px 20px",
          borderRadius: "12px",
          fontSize: "13px",
        }}
        onClick={() => openModal()}
      >
        + SET NEW SCHEDULE
      </button>
    </div>

    {/* Schedule List */}
    {schedules.map((s) => (
      <WebScheduleRow
        key={s.id}
        sched={s}
        onEdit={() => openModal(s)}
        onDelete={() => handleDeleteSchedule(s.id)}
      onToggle={() => setScheduleToToggle(s)}
      />
    ))}
  </div>
)}

{activeTab === "history" && (
  <div>
    {/* History Header */}
    <div
      style={{
        ...styles.schedHeaderRow,
        marginBottom: "18px",
      }}
    >
      <p
        className="history-heading"
        style={{
          ...styles.sectionHead,
          fontSize: "16px",
          color: "#AEB7C7",
          margin: 0,
        }}
      >
        SYSTEM ACTIVITY LOG
      </p>

      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <button
          style={{
            ...styles.clearBtn,
            padding: "7px 12px",
            fontSize: "10px",
          }}
          onClick={handleClearHistory}
        >
          CLEAR ALERT LOGS
        </button>

        <button
          style={{
            ...styles.clearBtn,
            backgroundColor: "#f59e0b",
            color: "#ffffff",
            border: "none",
            padding: "7px 12px",
            fontSize: "10px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
          onClick={handleClearValveHistory}
        >
          WIPE VALVE LOGS
        </button>
      </div>
    </div>

    {/* History Content */}
    {history.length > 0 ? (
      <div>
        {/* =========================
            FIXED HISTORY FILTER
        ========================== */}
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            marginBottom: "10px",
            boxSizing: "border-box",
          }}
        >
          <select
            value={historyFilter}
            onChange={(e) => setHistoryFilter(e.target.value)}
            style={{
              background: "#0d1f3c",
              color: "#ffffff",
              border: "1px solid #1e3a5f",
              borderRadius: "6px",
              padding: "6px 10px",
              fontSize: "10px",
              fontWeight: "bold",
              outline: "none",
              cursor: "pointer",
              minWidth: "95px",
            }}
          >
            <option value="ALL">ALL LOGS</option>
            <option value="VALVE">VALVE</option>
            <option value="LOGIN">LOGIN</option>
            <option value="ALERT">ALERT</option>
            <option value="LORA">LORA</option>
          </select>
        </div>

        {/* =========================
            TABLE ONLY SCROLLS
        ========================== */}
        <div
          style={{
            width: "100%",
            maxWidth: "100%",
            overflowX: "auto",
            overflowY: "hidden",
            boxSizing: "border-box",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Table Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "110px 110px minmax(180px, 1fr) 110px 100px 100px 120px",
              gap: "6px",
              marginBottom: "6px",
              minWidth: "760px",
            }}
          >
            {[
              "TIME",
              "LOG TYPE",
              "DESCRIPTION",
              "USER",
              "STATUS",
              "ACK BY",
              "TIMESTAMP",
            ].map((heading) => (
              <div
                key={heading}
                style={{
                  background: "#ffffff",
                  color: "#0d1f3c",
                  padding: "6px 8px",
                  borderRadius: "4px",
                  fontSize: "9px",
                  fontWeight: "800",
                  textAlign: "center",
                  boxSizing: "border-box",
                }}
              >
                {heading}
              </div>
            ))}
          </div>

          {/* Activity Rows */}
          {history
            .filter(
              (log) =>
                historyFilter === "ALL" ||
                log.logType === historyFilter
            )
            .map((log) => {
              const isWarning = log.type === "warning";
              const isDanger = log.type === "danger";

              const rowColor = isDanger
                ? "#ef4444"
                : isWarning
                ? "#f59e0b"
                : "#22c55e";

              return (
                <div
                  key={log.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "110px 110px minmax(180px, 1fr) 110px 100px 100px 120px",
                    gap: "6px",
                    minWidth: "760px",
                    marginBottom: "6px",
                  }}
                >
                  {/* TIME */}
                  <div
                    style={{
                      background: rowColor,
                      color: "#06101d",
                      padding: "7px 8px",
                      borderRadius: "4px",
                      fontSize: "9px",
                      fontWeight: "700",
                    }}
                  >
                    {log.time}
                  </div>

                  {/* LOG TYPE */}
                  <div
                    style={{
                      background: rowColor,
                      color: "#06101d",
                      padding: "7px 8px",
                      borderRadius: "4px",
                      fontSize: "9px",
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    {log.logType}
                  </div>

                  {/* DESCRIPTION */}
                  <div
                    style={{
                      background: rowColor,
                      color: "#06101d",
                      padding: "7px 8px",
                      borderRadius: "4px",
                      fontSize: "9px",
                      fontWeight: "700",
                    }}
                  >
                    {log.event}
                  </div>

                  {/* USER */}
                  <div
                    style={{
                      background: rowColor,
                      color: "#06101d",
                      padding: "7px 8px",
                      borderRadius: "4px",
                      fontSize: "9px",
                      textAlign: "center",
                    }}
                  >
                    {log.user}
                  </div>

                  {/* STATUS */}
                  <div
                    style={{
                      background: rowColor,
                      color: "#06101d",
                      padding: "7px 8px",
                      borderRadius: "4px",
                      fontSize: "9px",
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    {log.status}
                  </div>

                  {/* ACK BY */}
                  <div
                    style={{
                      background: rowColor,
                      color: "#06101d",
                      padding: "7px 8px",
                      borderRadius: "4px",
                      fontSize: "9px",
                      textAlign: "center",
                    }}
                  >
                    {log.ackBy}
                  </div>

                  {/* TIMESTAMP */}
                  <div
                    style={{
                      background: rowColor,
                      color: "#06101d",
                      padding: "7px 8px",
                      borderRadius: "4px",
                      fontSize: "9px",
                      textAlign: "center",
                    }}
                  >
                    {log.timestamp}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    ) : (
      <p
        style={{
          textAlign: "center",
          color: "#64748b",
          marginTop: "80px",
          fontSize: "12px",
        }}
      >
        No logs found.
      </p>
    )}
  </div>
)}
      </main>
    </div>
  );
}


