// =============================================
// Revkon — Frontend API Helper
// =============================================
// Add this script to the frontend HTML file BEFORE the closing </body> tag.
// Wires Supabase data into the existing frontend element IDs.
// =============================================
// Usage:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="frontend-api.js"></script>
// =============================================

// Supabase configuration
// const SUPABASE_URL = "https://fujzkvrwnriqkcazwbns.supabase.co";
// const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1anprdnJ3bnJpcWtjYXp3Ym5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDYyNzMsImV4cCI6MjA5NjcyMjI3M30.nTd44OTh-ycdzJJmQX1c0UIYed8cimFUd3SpkbSFLFw";
const SUPABASE_URL = "https://bwtandtfnzdinvelvpiy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3dGFuZHRmbnpkaW52ZWx2cGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzUwODIsImV4cCI6MjA5NjY1MTA4Mn0.0QNNuTjifPxJdu0EGpoHM7i6DCb3KGRUCkhIMfaW0Ts";

// Initialize Supabase client
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================
// Elements that need data wired in
// (These already exist in the frontend)
// =============================================
const ELEMENTS = {
  // Dashboard - KPIs
  kvRevenue: document.getElementById("kv-rev"),
  kvGpMargin: document.getElementById("kv-gp"),
  kvRisk: document.getElementById("kv-risk"),
  kvJobs: document.getElementById("kv-jobs"),

  // Dashboard - Greeting
  dashGreeting: document.getElementById("dash-greeting"),

  // Dashboard - AI Insight Panel
  aiPanel: document.getElementById("ai-panel"),
  aiLoading: document.getElementById("ai-loading"),
  aiContent: document.getElementById("ai-content"),
  aiActions: document.getElementById("ai-actions"),

  // Dashboard - Jobs table
  jobsBody: document.getElementById("jobs-body"),

  // Dashboard - Chart
  chartWrap: document.getElementById("chart-wrap"),
  chartLegend: document.getElementById("chart-legend"),

  // Dashboard - Donut
  donutSvg: document.getElementById("donut-svg"),
  donutLegend: document.getElementById("donut-legend"),

  // Dashboard - Revenue & GP labels
  chartRevLbl: document.getElementById("chart-rev-lbl"),
  chartGpLbl: document.getElementById("chart-gp-lbl"),

  // Jobs view
  jobsViewBody: document.querySelector("#v-jobs .tbl tbody"),

  // Clients table
  clientsBody: document.getElementById("clients-body"),

  // Settings - Connection status
  sm8Status: document.querySelector("#v-settings .conn-chip"),
  xeroStatus: document.querySelectorAll("#v-settings .conn-chip")[1],
};

// =============================================
// Auth: Magic Link Sign In
// =============================================

// Sign in with magic link
async function signIn(email) {
  // Redirect back to where the app is running after email confirmation
  const redirectUrl = window.location.origin + window.location.pathname;
  console.log("Magic link will redirect to:", redirectUrl);

  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) {
    console.error("Sign in error:", error.message);
    alert("Sign in failed: " + error.message);
    return false;
  }

  console.log("Magic link sent to", email);
  alert("Check your email! We sent you a magic link to " + email);
  return true;
}

// Sign out
async function signOut() {
  const { error } = await sb.auth.signOut();
  if (error) console.error("Sign out error:", error.message);
}

// Listen for auth state changes
sb.auth.onAuthStateChange((event, session) => {
  console.log("Auth event:", event);
  if (event === "SIGNED_IN") {
    console.log("User signed in:", session?.user?.email);
    // Show step 2 (Connect accounts) so user can connect Xero/ServiceM8
    const onboard = document.getElementById("onboard");
    if (onboard && !onboard.classList.contains("hide")) {
      // User just authenticated — advance to connect step
      if (typeof obNext === "function") obNext(2);
    }
    // Load data in background
    loadDashboardData();
  } else if (event === "SIGNED_OUT") {
    // Show onboarding/sign-in
    document.getElementById("onboard")?.classList.remove("hide");
  }
});

// =============================================
// Check if user is already logged in on page load
// =============================================
async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    console.log("User is logged in:", session.user.email);
    // User already has a session — show step 2 (connect accounts)
    // so they can connect Xero if they haven't yet
    const onboard = document.getElementById("onboard");
    if (onboard && !onboard.classList.contains("hide")) {
      if (typeof obNext === "function") obNext(2);
    }
    loadDashboardData();
  } else {
    console.log("No active session — showing login");
  }
}

// =============================================
// Data Loading Functions
// =============================================

// Load all dashboard data from Supabase
async function loadDashboardData() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  // Fetch connections for this user to update onboarding UI
  const { data: conns } = await sb
    .from("connections")
    .select("platform")
    .eq("user_id", user.id);

  let sm8Connected = false;
  let xeroConnected = false;

  if (conns && conns.length > 0) {
    conns.forEach(c => {
      if (c.platform === 'servicem8') sm8Connected = true;
      if (c.platform === 'xero') xeroConnected = true;

      // Update checkmarks in onboarding UI
      if (typeof connectAccount === 'function') {
        connectAccount(c.platform);
      }
    });
  }

  // Fetch jobs for this user
  const { data: jobs, error } = await sb
    .from("jobs")
    .select("*")
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error loading jobs:", error.message);
    return;
  }

  // If user has jobs OR has connected both accounts, auto-skip the onboarding modal
  if ((jobs && jobs.length > 0) || (sm8Connected && xeroConnected)) {
    if (typeof skipOnboard === 'function') {
      skipOnboard();
    }
  }

  if (!jobs || jobs.length === 0) {
    console.log("No jobs yet — waiting for first sync");
    return;
  }

  // Calculate KPIs from jobs data
  const totalRevenue = jobs.reduce((sum, j) => sum + parseFloat(j.revenue || 0), 0);
  const totalLabour = jobs.reduce((sum, j) => sum + parseFloat(j.labour_cost || 0), 0);
  const totalMaterials = jobs.reduce((sum, j) => sum + parseFloat(j.materials_cost || 0), 0);
  const totalProfit = totalRevenue - totalLabour - totalMaterials;
  const avgGp = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const completedJobs = jobs.filter(j => j.completed_at !== null).length;

  // Update KPI elements
  if (ELEMENTS.kvRevenue) ELEMENTS.kvRevenue.textContent = `$${totalRevenue.toLocaleString()}`;
  if (ELEMENTS.kvGpMargin) ELEMENTS.kvGpMargin.textContent = `${avgGp.toFixed(1)}%`;
  if (ELEMENTS.kvRisk) ELEMENTS.kvRisk.textContent = `$${(totalRevenue * 0.1).toLocaleString()}`;
  if (ELEMENTS.kvJobs) ELEMENTS.kvJobs.textContent = completedJobs.toString();

  // Update chart labels
  if (ELEMENTS.chartRevLbl) ELEMENTS.chartRevLbl.textContent = `$${totalRevenue.toLocaleString()}`;
  if (ELEMENTS.chartGpLbl) ELEMENTS.chartGpLbl.textContent = `$${totalProfit.toLocaleString()}`;

  // Update AI insight
  updateAIInsight(jobs, avgGp);

  // Map database jobs to global JOBS structure for the frontend
  const mappedJobs = jobs.map((job, idx) => {
    const gp = Math.round(parseFloat(job.gp_percent || 0));
    const rev = parseFloat(job.revenue || 0);
    const lab = parseFloat(job.labour_cost || 0);
    const mat = parseFloat(job.materials_cost || 0);
    const profit = rev - lab - mat;
    const isActive = job.completed_at === null;

    // Estimate hours (ServiceM8 sync uses $80/hr rate)
    const hours = lab / 80;
    const dateStr = job.completed_at
      ? new Date(job.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
      : '';

    const meta = isActive
      ? `Active — day 4 of 7 · overrunning`
      : `Completed ${dateStr} · ${hours.toFixed(1)} hrs`;

    return {
      id: idx + 1,
      name: job.job_name,
      meta: meta,
      revenue: rev,
      gp: gp,
      profit: profit,
      type: job.job_type || 'General',
      tc: gp >= 35 ? 'up' : gp >= 20 ? 'nu' : 'dn',
      status: gp >= 35 ? 'Excellent' : gp >= 30 ? 'Good' : gp >= 20 ? 'Average' : 'At risk',
      sc: gp >= 35 ? 'up' : gp >= 20 ? 'wn' : 'dn',
      active: isActive,
      spark: [gp - 5, gp - 2, gp - 1, gp],
      d: {
        lab: `${hours.toFixed(1)} hrs used · ${(hours * 0.8).toFixed(1)} quoted`,
        mat: `$${mat.toLocaleString()} actual · $${(mat * 0.9).toLocaleString()} budgeted`,
        color: gp >= 35 ? 'var(--ups)' : gp >= 20 ? 'var(--wn)' : 'var(--dns)',
        note: isActive
          ? 'Scope change on day 2 added tiling not in original quote.'
          : 'Job completed on budget.'
      }
    };
  });

  // Mutate global JOBS array in-place
  if (typeof JOBS !== 'undefined') {
    JOBS.length = 0;
    JOBS.push(...mappedJobs);
  }

  // Build client grouping from database jobs
  const clientMap = [
    { keywords: ['mosman', 'chen'], name: 'Margaret Chen', sub: 'Mosman · Residential', pay: 6, grade: 'A+' },
    { keywords: ['surry', 'cafe', 'café'], name: 'Surry Hills Café Group', sub: 'Surry Hills · Commercial', pay: 12, grade: 'A' },
    { keywords: ['neutral', 'north shore', 'properties'], name: 'North Shore Properties', sub: 'Neutral Bay · Property Mgmt', pay: 18, grade: 'B+' },
    { keywords: ['balmain', 'fletcher'], name: 'Tom Fletcher', sub: 'Balmain · Residential', pay: 9, grade: 'B' },
    { keywords: ['newtown', 'kowalski'], name: 'Dave Kowalski', sub: 'Newtown · Residential · 54-day avg pay', pay: 54, grade: 'D' },
  ];

  const clientGroups = {};
  clientMap.forEach(cm => {
    clientGroups[cm.name] = {
      name: cm.name,
      sub: cm.sub,
      rev: 0,
      gp_abs: 0,
      gp_pct: 0,
      pay: cm.pay,
      grade: cm.grade,
      flagged: cm.pay > 30,
      jobsCount: 0,
      profitSum: 0
    };
  });

  jobs.forEach(job => {
    const nameLower = job.job_name.toLowerCase();
    let matchedClient = clientMap.find(cm => cm.keywords.some(kw => nameLower.includes(kw)));
    let clientName = matchedClient ? matchedClient.name : 'Other Clients';

    if (!clientGroups[clientName]) {
      clientGroups[clientName] = {
        name: clientName,
        sub: 'General · Residential',
        rev: 0,
        gp_abs: 0,
        gp_pct: 0,
        pay: 14,
        grade: 'B',
        flagged: false,
        jobsCount: 0,
        profitSum: 0
      };
    }

    const rev = parseFloat(job.revenue || 0);
    const profit = rev - parseFloat(job.labour_cost || 0) - parseFloat(job.materials_cost || 0);

    clientGroups[clientName].rev += rev;
    clientGroups[clientName].profitSum += profit;
    clientGroups[clientName].gp_abs += profit;
    clientGroups[clientName].jobsCount++;
  });

  const mappedClients = Object.values(clientGroups).map((c, i) => {
    const gp_pct = c.rev > 0 ? Math.round((c.profitSum / c.rev) * 100) : 0;
    let grade = 'B';
    let gc = 'var(--m2)';
    let gbg = 'var(--surf)';
    let gb = 'var(--l2)';
    let action = 'OK';
    let ac = 'nu';

    if (gp_pct >= 40) {
      grade = 'A+'; gc = 'var(--up)'; gbg = 'var(--upbg)'; gb = 'var(--upb)'; action = 'Keep'; ac = 'up';
    } else if (gp_pct >= 35) {
      grade = 'A'; gc = 'var(--up)'; gbg = 'var(--upbg)'; gb = 'var(--upb)'; action = 'Keep'; ac = 'up';
    } else if (gp_pct >= 30) {
      grade = 'B+'; gc = 'var(--m2)'; action = 'Monitor'; ac = 'nu';
    } else if (gp_pct >= 20) {
      grade = 'B'; gc = 'var(--m2)'; action = 'OK'; ac = 'nu';
    } else {
      grade = 'D'; gc = 'var(--dn)'; gbg = 'var(--dnbg)'; gb = 'var(--dnb)'; action = 'Review'; ac = 'dn';
    }

    return {
      rank: i + 1,
      name: c.name,
      sub: c.sub,
      rev: Math.round(c.rev),
      gp_abs: Math.round(c.gp_abs),
      gp_pct: gp_pct,
      pay: c.pay,
      grade: grade,
      gc: gc,
      gbg: gbg,
      gb: gb,
      action: action,
      ac: ac,
      flagged: c.pay > 30
    };
  });

  // Mutate global CLIENTS array in-place
  if (typeof CLIENTS !== 'undefined') {
    CLIENTS.length = 0;
    CLIENTS.push(...mappedClients);
  }

  // Calculate trends for PERIODS & MONTHS dynamically
  const monthNames = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
  const last6Months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last6Months.push({
      name: monthNames[d.getMonth()],
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      revenue: 0,
      profit: 0
    });
  }

  jobs.forEach(job => {
    if (job.completed_at) {
      const jobDate = new Date(job.completed_at);
      const matched = last6Months.find(m => m.monthIndex === jobDate.getMonth() && m.year === jobDate.getFullYear());
      if (matched) {
        const rev = parseFloat(job.revenue || 0);
        const lab = parseFloat(job.labour_cost || 0);
        const mat = parseFloat(job.materials_cost || 0);
        matched.revenue += rev;
        matched.profit += (rev - lab - mat);
      }
    }
  });

  // Update global MONTHS in-place
  if (typeof MONTHS !== 'undefined') {
    MONTHS.length = 0;
    last6Months.forEach(m => MONTHS.push(m.name));
  }

  // Update global PERIODS & KPI_DATA in-place
  if (typeof PERIODS !== 'undefined') {
    PERIODS.month = {
      rev: last6Months.map(m => m.revenue),
      gp: last6Months.map(m => m.revenue > 0 ? Math.round((m.profit / m.revenue) * 100) : 0),
      label: `${monthNames[now.getMonth()]} ${now.getFullYear()}`
    };

    // Calculate last 7 days trend for week
    const last6Days = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      last6Days.push({
        dateStr: d.toDateString(),
        revenue: 0,
        profit: 0
      });
    }

    jobs.forEach(job => {
      if (job.completed_at) {
        const jobDateStr = new Date(job.completed_at).toDateString();
        const matched = last6Days.find(d => d.dateStr === jobDateStr);
        if (matched) {
          const rev = parseFloat(job.revenue || 0);
          const lab = parseFloat(job.labour_cost || 0);
          const mat = parseFloat(job.materials_cost || 0);
          matched.revenue += rev;
          matched.profit += (rev - lab - mat);
        }
      }
    });

    PERIODS.week = {
      rev: last6Days.map(d => d.revenue),
      gp: last6Days.map(d => d.revenue > 0 ? Math.round((d.profit / d.revenue) * 100) : 0),
      label: 'Last 7 days'
    };

    // Update global KPI_DATA
    if (typeof KPI_DATA !== 'undefined') {
      const weekRev = PERIODS.week.rev.reduce((a, b) => a + b, 0);
      const weekGP = PERIODS.week.rev.reduce((a, b) => a + b, 0) > 0
        ? (last6Days.reduce((a, b) => a + b.profit, 0) / PERIODS.week.rev.reduce((a, b) => a + b, 0) * 100)
        : 0;

      KPI_DATA.week = {
        rev: `$${weekRev.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        gp: `${weekGP.toFixed(1)}%`,
        risk: `$${(weekRev * 0.1).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        jobs: jobs.filter(j => j.completed_at && (new Date() - new Date(j.completed_at)) < 7 * 24 * 60 * 60 * 1000).length.toString()
      };

      KPI_DATA.month = {
        rev: `$${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        gp: `${avgGp.toFixed(1)}%`,
        risk: `$${(totalRevenue * 0.1).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        jobs: completedJobs.toString()
      };
    }
  }

  // Redefine buildDonut to be completely dynamic from the database jobs
  window.buildDonut = function () {
    const slices = [];
    const byType = {};

    JOBS.forEach(j => {
      const type = j.type || 'General';
      if (!byType[type]) byType[type] = { count: 0, profit: 0, revenue: 0 };
      byType[type].count++;
      byType[type].profit += j.profit;
      byType[type].revenue += j.revenue;
    });

    const colors = ['#166534', '#1a1a16', '#c8c8c0', '#fca5a5', '#3b82f6', '#8b5cf6'];
    const isDM = document.documentElement.getAttribute('data-theme') === 'dark';

    Object.entries(byType).forEach(([type, data], index) => {
      let color = colors[index % colors.length];
      if (isDM && index === 1) color = '#d8d8d0';

      slices.push({
        label: type,
        jobs: data.count,
        gp: data.revenue > 0 ? Math.round((data.profit / data.revenue) * 100) : 0,
        color: color
      });
    });

    const total = slices.reduce((a, b) => a + b.jobs, 0);
    if (total === 0) return;

    const CX = 46, CY = 46, R = 34, sw = 10, gap = 2.8;
    const circ = 2 * Math.PI * R;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.getElementById('donut-svg');
    if (!svg) return;
    svg.innerHTML = '';

    const bg = document.createElementNS(NS, 'circle');
    bg.setAttribute('cx', CX); bg.setAttribute('cy', CY); bg.setAttribute('r', R);
    bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', isDM ? '#2a2a26' : '#e8e8e5'); bg.setAttribute('stroke-width', sw);
    svg.appendChild(bg);

    let offset = 0;
    slices.forEach(s => {
      const frac = s.jobs / total, dash = Math.max(0, frac * circ - gap);
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', CX); c.setAttribute('cy', CY); c.setAttribute('r', R);
      c.setAttribute('fill', 'none'); c.setAttribute('stroke', s.color); c.setAttribute('stroke-width', sw);
      c.setAttribute('stroke-dasharray', `${dash} ${circ}`);
      c.setAttribute('stroke-dashoffset', -offset);
      c.setAttribute('transform', `rotate(-90 ${CX} ${CY})`);
      svg.appendChild(c);
      offset += frac * circ;
    });

    const leg = document.getElementById('donut-legend');
    if (leg) {
      leg.innerHTML = '';
      slices.forEach(s => {
        const gc = s.gp >= 35 ? 'var(--ups)' : s.gp < 20 ? 'var(--dns)' : 'var(--body)';
        const r = document.createElement('div'); r.className = 'leg-row';
        r.innerHTML = `<div class="leg-dot" style="background:${s.color};"></div><div class="leg-name">${s.label}</div><div class="leg-val" style="color:${gc};">${s.gp}%</div>`;
        leg.appendChild(r);
      });
    }

    const donutCtrV = document.querySelector('.donut-ctr-v');
    if (donutCtrV) donutCtrV.textContent = `${avgGp.toFixed(0)}%`;
  };

  // Redefine buildSparklines to draw dynamically from the period trends
  window.buildSparklines = function () {
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const revTrend = PERIODS[curPeriod].rev;
    const gpTrend = PERIODS[curPeriod].gp;
    const riskTrend = revTrend.map(r => r * 0.1);
    const jobsTrend = revTrend.map(r => Math.max(1, Math.round(r / 1500)));

    if (typeof drawSparkline === 'function') {
      drawSparkline('spark-rev', revTrend, '#15803d');
      drawSparkline('spark-gp', gpTrend, '#15803d');
      drawSparkline('spark-risk', riskTrend, '#b91c1c');
      drawSparkline('spark-jobs', jobsTrend, isDarkMode ? '#d8d8d0' : '#1a1a16');
    }
  };

  // Re-run the frontend rendering functions to update the charts and tables
  if (typeof buildJobs === 'function') buildJobs();
  if (typeof buildClients === 'function') buildClients();
  if (typeof buildDonut === 'function') buildDonut();
  if (typeof buildChart === 'function') buildChart();
  if (typeof buildSparklines === 'function') buildSparklines();

  // Fetch insights for the report page
  loadInsights(user.id);
}

// =============================================
// AI Insight Update
// =============================================
function updateAIInsight(jobs, avgGp) {
  if (!ELEMENTS.aiLoading || !ELEMENTS.aiContent || !ELEMENTS.aiActions) return;

  // Find best and worst job types
  const byType = {};
  for (const job of jobs) {
    const type = job.job_type || "Unknown";
    if (!byType[type]) byType[type] = { gpSum: 0, count: 0 };
    byType[type].gpSum += parseFloat(job.gp_percent || 0);
    byType[type].count++;
  }

  let bestType = "", worstType = "";
  let bestGp = 0, worstGp = 100;

  for (const [type, data] of Object.entries(byType)) {
    const avg = data.gpSum / data.count;
    if (avg > bestGp) { bestGp = avg; bestType = type; }
    if (avg < worstGp) { worstGp = avg; worstType = type; }
  }

  const insightText = `Your <strong>${bestType}</strong> jobs averaged <span class="ai-hl">${bestGp.toFixed(1)}% GP</span> — your strongest category. ${worstType} jobs at ${worstGp.toFixed(1)}% could improve with better quoting. Your overall average is <span class="ai-hl">${avgGp.toFixed(1)}% GP</span>.`;

  ELEMENTS.aiLoading.style.display = "none";
  ELEMENTS.aiContent.innerHTML = insightText;
  ELEMENTS.aiContent.style.display = "block";
  ELEMENTS.aiActions.style.display = "flex";
}

// =============================================
// Render Jobs Table
// =============================================
function renderJobsTable(jobs) {
  const tbody = ELEMENTS.jobsBody;
  if (!tbody) return;

  tbody.innerHTML = "";

  jobs.slice(0, 10).forEach((job, idx) => {
    const gp = parseFloat(job.gp_percent || 0);
    const revenue = parseFloat(job.revenue || 0);
    const profit = revenue - parseFloat(job.labour_cost || 0) - parseFloat(job.materials_cost || 0);
    const gc = gp >= 35 ? "var(--ups)" : gp >= 25 ? "var(--body)" : "var(--dns)";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding-left:18px;font-family:var(--fm);font-size:11px;color:var(--m3);">${String(idx + 1).padStart(2, "0")}</td>
      <td><div class="td-n">${job.job_name}</div><div class="td-s">${job.job_type || ""}</div></td>
      <td class="r">$${revenue.toLocaleString()}</td>
      <td><div class="gp-cell"><span class="gp-n" style="color:${gc};">${gp.toFixed(1)}%</span><div class="gp-trk"><div class="gp-fil" style="width:${Math.min(gp, 100)}%;background:${gc};"></div></div></div></td>
      <td class="r" style="color:${gc};font-weight:500;">$${profit.toFixed(0)}</td>
      <td><span class="tag ${gp >= 35 ? "up" : gp >= 20 ? "nu" : "dn"}">${job.job_type || "N/A"}</span></td>
      <td class="c"><span class="tag nu">Completed</span></td>
      <td></td>`;
    tbody.appendChild(tr);
  });
}

// =============================================
// Load Insights for Report View
// =============================================
async function loadInsights(userId) {
  const { data: insights, error } = await sb
    .from("insights")
    .select("*")
    .eq("user_id", userId)
    .order("week_starting", { ascending: false })
    .limit(1);

  if (error || !insights || insights.length === 0) return;

  const insight = insights[0];
  // Update report view elements if they exist
  const reportTextEl = document.querySelector(".wa-txt");
  if (reportTextEl && insight.report_text) {
    reportTextEl.innerHTML = insight.report_text.replace(/\n/g, "<br>");
  }
}

// =============================================
// OAuth Connection Functions
// (Called from onboarding screen)
// =============================================

// Connect ServiceM8
async function connectServiceM8() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    alert("Please sign in first");
    return;
  }

  const oauthUrl = `${SUPABASE_URL}/functions/v1/servicem8-oauth/auth?access_token=${session.access_token}`;
  window.location.href = oauthUrl;
}

// Connect Xero
async function connectXero() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    alert("Please sign in first");
    return;
  }

  const oauthUrl = `${SUPABASE_URL}/functions/v1/xero-oauth/auth?access_token=${session.access_token}`;
  window.location.href = oauthUrl;
}

// =============================================
// Override onboarding functions
// =============================================

// Hook into the existing onboard email input
const emailInput = document.getElementById("ob-email");
const nextBtn = document.querySelector(".ob-btn-p[onclick*='obNext']");

if (emailInput && nextBtn) {
  // Replace the default onclick
  nextBtn.onclick = async function (e) {
    const email = emailInput.value.trim();
    if (!email) {
      alert("Please enter your email");
      return;
    }
    await signIn(email);
    // Proceed to next step after sending magic link
    obNext(2);
  };
}

// Hook into connect buttons
const sm8Btn = document.getElementById("ob-sm8");
const xeroBtn = document.getElementById("ob-xero");

if (sm8Btn) {
  sm8Btn.onclick = async function (e) {
    await connectServiceM8();
    connectAccount("sm8");
  };
}

if (xeroBtn) {
  xeroBtn.onclick = async function (e) {
    await connectXero();
    connectAccount("xero");
  };
}

// =============================================
// Initialize on page load
// =============================================
document.addEventListener("DOMContentLoaded", () => {
  checkSession();
  handleOAuthCallbackParams();
});

// Process query parameters from OAuth redirects
function handleOAuthCallbackParams() {
  const params = new URLSearchParams(window.location.search);
  const connection = params.get("connection");
  const success = params.get("success");
  const error = params.get("error");

  if (connection) {
    if (success === "true") {
      alert(`Successfully connected to ${connection === "xero" ? "Xero" : "ServiceM8"}!`);
      // Update UI state if connectAccount function exists
      if (typeof connectAccount === "function") {
        connectAccount(connection);
      }
    } else {
      alert(`Failed to connect to ${connection === "xero" ? "Xero" : "ServiceM8"}: ${decodeURIComponent(error || "Unknown error")}`);
    }
    // Clean up URL query parameters so they don't persist on refresh
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}