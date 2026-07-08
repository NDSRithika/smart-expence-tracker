/**
 * Ledger - Smart Expense Tracker Client-Side Core
 * -----------------------------------------------
 * Implements AJAX communications, UI modal animations, Chart.js data binding,
 * real-time input validations, toast alerting, and smart client filters.
 */

// Global State References
let currentCategories = [];
let categoryChartInstance = null;
let dailyTrendChartInstance = null;
let monthlySpendingChartInstance = null;
let savingsProgressChartInstance = null;

// Pagination State
let allExpensesData = [];
let expensesCurrentPage = 1;
const expensesPageSize = 10;

// ================= TOAST NOTIFICATIONS =================

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let iconName = "check-circle";
  if (type === "error") iconName = "alert-triangle";
  if (type === "warning") iconName = "alert-circle";
  if (type === "info") iconName = "info";

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="toast-icon"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  // Trigger entering animation
  setTimeout(() => toast.classList.add("active"), 10);

  // Remove toast after 3.5 seconds
  setTimeout(() => {
    toast.classList.remove("active");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ================= CURRENCY FORMATTING =================

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// ================= UNIVERSAL MODAL SYSTEM =================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden"; // Prevent background scroll
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

// Mount universal modal triggers and listeners
document.addEventListener("DOMContentLoaded", () => {
  // Bind close buttons inside modals
  document.querySelectorAll("[data-close-modal]").forEach(button => {
    button.addEventListener("click", () => {
      const modalId = button.getAttribute("data-close-modal");
      closeModal(modalId);
    });
  });

  // Close modal when clicking overlay (outside the card)
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Escape key close support
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.active").forEach(activeModal => {
        closeModal(activeModal.id);
      });
    }
  });

  // Setup theme synchronizer (loads and saves to local storage)
  initUniversalTheme();
});

function initUniversalTheme() {
  const themeToggle = document.getElementById("theme-toggle");
  if (!themeToggle) return;

  const themeIcon = document.getElementById("theme-icon");
  const html = document.documentElement;

  const savedTheme = localStorage.getItem("ledger-theme") || "light";
  html.setAttribute("data-theme", savedTheme);
  updateThemeToggleUI(savedTheme, themeIcon);

  themeToggle.addEventListener("click", () => {
    const currentTheme = html.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", newTheme);
    localStorage.setItem("ledger-theme", newTheme);
    updateThemeToggleUI(newTheme, themeIcon);
    
    // If charts exist on the active page, re-render them with updated grid color tokens
    if (document.getElementById("categoryChart")) {
      refreshChartsTheme();
    }
  });
}

function updateThemeToggleUI(theme, iconElement) {
  if (!iconElement) return;
  if (theme === "dark") {
    iconElement.setAttribute("data-lucide", "sun");
  } else {
    iconElement.setAttribute("data-lucide", "moon");
  }
  lucide.createIcons();
}

function refreshChartsTheme() {
  // Triggers re-fetch of summary to re-plot ChartJS with correct colors
  if (typeof loadDashboardData === "function") {
    loadDashboardData();
  }
}

// ================= SHARABLE CATEGORIES FETCHER =================

async function fetchCategoriesList(selectElementId = "select-expense-cat") {
  try {
    const res = await fetch("/api/categories");
    const data = await res.json();
    if (res.ok) {
      currentCategories = data.categories;
      populateCategoryDropdowns(data.categories, selectElementId);
      return data.categories;
    } else {
      console.error("Error loading categories:", data.error);
    }
  } catch (err) {
    console.error("Failed fetching categories API:", err);
  }
  return [];
}

function populateCategoryDropdowns(categories, selectElementId) {
  const select = document.getElementById(selectElementId);
  if (!select) return;

  select.innerHTML = "";
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });
}

// ================= DASHBOARD PAGE LOGIC =================

async function initDashboard() {
  console.log("Initializing Smart Dashboard page...");
  
  // Set default form date to today
  const today = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("input-expense-date");
  if (dateInput) dateInput.value = today;

  // Fetch initial category list and update modal dropdowns
  await fetchCategoriesList("select-expense-cat");

  // Load Dashboard cards, recommendations, charts, and table
  await loadDashboardData();

  // Mount action listeners
  mountDashboardListeners();
}

async function loadDashboardData() {
  try {
    const res = await fetch("/api/summary");
    const summary = await res.json();
    if (!res.ok) {
      showToast("Error updating dashboard data.", "error");
      return;
    }

    // Onboarding banner trigger
    const onboardingBanner = document.getElementById("advisor-onboarding-banner");
    if (onboardingBanner) {
      if ((summary.monthlySalary || 0) === 0 && (summary.savingsGoal || 0) === 0) {
        onboardingBanner.style.display = "block";
      } else {
        onboardingBanner.style.display = "none";
      }
    }

    // 1. Update Core Advisor Cards
    document.getElementById("stat-salary").textContent = formatCurrency(summary.monthlySalary || 0);
    document.getElementById("stat-savings-goal").textContent = formatCurrency(summary.savingsGoal || 0);
    document.getElementById("stat-budget").textContent = formatCurrency(summary.monthlyBudget || 0);
    document.getElementById("stat-spent").textContent = formatCurrency(summary.monthlySpent || 0);
    
    // Remaining Balance/Budget with absolute values and color context
    const remaining = summary.remainingBudget || 0;
    const statRemaining = document.getElementById("stat-remaining");
    const statRemainingDesc = document.getElementById("stat-remaining-desc");
    const statRemainingIcon = document.getElementById("stat-remaining-icon");

    statRemaining.textContent = formatCurrency(Math.abs(remaining));
    if (remaining < 0) {
      statRemaining.style.color = "var(--rose)";
      if (statRemainingDesc) statRemainingDesc.textContent = "Deficit (Budget exceeded)";
      if (statRemainingIcon) {
        statRemainingIcon.style.backgroundColor = "var(--rose-light)";
        statRemainingIcon.style.color = "var(--rose)";
      }
    } else {
      statRemaining.style.color = "";
      if (statRemainingDesc) statRemainingDesc.textContent = "Safe to spend";
      if (statRemainingIcon) {
        statRemainingIcon.style.backgroundColor = "var(--emerald-light)";
        statRemainingIcon.style.color = "var(--emerald)";
      }
    }

    // Expected Savings with color context
    const expectedSavings = summary.expectedSavings || 0;
    const statExpectedSavings = document.getElementById("stat-expected-savings");
    const statExpectedSavingsDesc = document.getElementById("stat-expected-savings-desc");
    const statExpectedSavingsIcon = document.getElementById("stat-expected-savings-icon");
    if (statExpectedSavings) {
      statExpectedSavings.textContent = formatCurrency(expectedSavings);
      if (expectedSavings < (summary.savingsGoal || 0)) {
        statExpectedSavings.style.color = "var(--amber)";
        if (statExpectedSavingsDesc) statExpectedSavingsDesc.textContent = "Below your savings target";
        if (statExpectedSavingsIcon) {
          statExpectedSavingsIcon.style.backgroundColor = "var(--amber-light)";
          statExpectedSavingsIcon.style.color = "var(--amber)";
        }
      } else {
        statExpectedSavings.style.color = "";
        if (statExpectedSavingsDesc) statExpectedSavingsDesc.textContent = "Savings target achieved!";
        if (statExpectedSavingsIcon) {
          statExpectedSavingsIcon.style.backgroundColor = "var(--emerald-light)";
          statExpectedSavingsIcon.style.color = "var(--emerald)";
        }
      }
    }

    // Budget Health Score Card & Badges
    const healthScore = summary.budgetHealthScore || 0;
    const healthRating = summary.budgetHealthRating || "Excellent";
    const statHealthScore = document.getElementById("stat-health-score");
    const statHealthRating = document.getElementById("stat-health-rating");
    const healthScoreValue = document.getElementById("health-score-value");
    const healthRatingBadge = document.getElementById("health-rating-badge");
    const statHealthIcon = document.getElementById("stat-health-icon");

    if (statHealthScore) statHealthScore.textContent = healthScore;
    if (healthScoreValue) healthScoreValue.textContent = healthScore;
    if (statHealthRating) statHealthRating.textContent = healthRating;
    if (healthRatingBadge) healthRatingBadge.textContent = healthRating;

    // Apply color theme to health rating displays
    let ratingColorHex = "var(--emerald)";
    let ratingBgHex = "var(--emerald-light)";
    if (healthRating === "Good") {
      ratingColorHex = "var(--emerald)";
      ratingBgHex = "var(--emerald-light)";
    } else if (healthRating === "Struggling") {
      ratingColorHex = "var(--amber)";
      ratingBgHex = "var(--amber-light)";
    } else if (healthRating === "Critical") {
      ratingColorHex = "var(--rose)";
      ratingBgHex = "var(--rose-light)";
    }

    [statHealthRating, healthRatingBadge].forEach(badge => {
      if (badge) {
        badge.style.backgroundColor = ratingBgHex;
        badge.style.color = ratingColorHex;
      }
    });
    if (statHealthIcon) {
      statHealthIcon.style.backgroundColor = ratingBgHex;
      statHealthIcon.style.color = ratingColorHex;
    }
    if (healthScoreValue) {
      healthScoreValue.style.color = ratingColorHex;
    }

    // Top Category Displays
    const topCatElem = document.getElementById("stat-top-category");
    const highestElem = document.getElementById("stat-highest");
    if (topCatElem) {
      topCatElem.textContent = summary.topCategory && summary.topCategory !== "None" ? summary.topCategory : "N/A";
    }
    if (highestElem) {
      highestElem.textContent = `${formatCurrency(summary.highestExpense || 0)} (highest)`;
    }

    // 2. Update Progress Bar
    const percent = Math.min(100, Math.max(0, summary.budgetUsedPercent || 0)).toFixed(1);
    const progressFill = document.getElementById("budget-progress-fill");
    const budgetBadge = document.getElementById("budget-badge");

    if (progressFill) progressFill.style.width = `${percent}%`;
    if (budgetBadge) budgetBadge.textContent = `${percent}% Used`;
    
    // Dynamic color coding
    if (progressFill) {
      progressFill.className = "progress-fill";
      if (summary.budgetUsedPercent > 90) {
        progressFill.classList.add("progress-danger");
        if (budgetBadge) {
          budgetBadge.style.backgroundColor = "var(--rose-light)";
          budgetBadge.style.color = "var(--rose)";
        }
      } else if (summary.budgetUsedPercent >= 70) {
        progressFill.classList.add("progress-warning");
        if (budgetBadge) {
          budgetBadge.style.backgroundColor = "var(--amber-light)";
          budgetBadge.style.color = "var(--amber)";
        }
      } else {
        progressFill.classList.add("progress-safe");
        if (budgetBadge) {
          budgetBadge.style.backgroundColor = "var(--emerald-light)";
          budgetBadge.style.color = "var(--emerald)";
        }
      }
    }

    const spentTxt = document.getElementById("progress-spent-text");
    const budgetTxt = document.getElementById("progress-budget-text");
    if (spentTxt) spentTxt.textContent = `Spent: ${formatCurrency(summary.monthlySpent || 0)}`;
    if (budgetTxt) budgetTxt.textContent = `Limit: ${formatCurrency(summary.monthlyBudget || 0)}`;

    // 3. Savings Goal Predictions & Suggestions
    const predText = document.getElementById("savings-prediction-text");
    if (predText) predText.textContent = summary.savingsPredictionMsg || "";

    const sugBox = document.getElementById("reduction-suggestions-box");
    const sugList = document.getElementById("reduction-suggestions-list");
    if (sugBox && sugList) {
      sugList.innerHTML = "";
      const suggestions = summary.reductionSuggestions || [];
      if (suggestions.length > 0) {
        sugBox.style.display = "block";
        suggestions.forEach(sug => {
          const li = document.createElement("li");
          li.style.display = "flex";
          li.style.alignItems = "center";
          li.style.gap = "8px";
          li.style.padding = "6px 8px";
          li.style.backgroundColor = "var(--bg-tertiary)";
          li.style.borderRadius = "4px";
          li.innerHTML = `
            <i data-lucide="scissors" style="width: 14px; height: 14px; color: var(--rose);"></i>
            <span>${sug}</span>
          `;
          sugList.appendChild(li);
        });
      } else {
        sugBox.style.display = "none";
      }
    }

    // 4. Budget Health Score Tips
    const tipsList = document.getElementById("health-tips-list");
    if (tipsList) {
      tipsList.innerHTML = "";
      const tips = summary.healthTips || [];
      if (tips.length > 0) {
        tips.forEach(tip => {
          const li = document.createElement("li");
          li.textContent = tip;
          tipsList.appendChild(li);
        });
      } else {
        const li = document.createElement("li");
        li.textContent = "Maintain your healthy budget progress to keep your top rating!";
        tipsList.appendChild(li);
      }
    }

    // 5. Analytical Rankings & Averages
    const rankTopCat = document.getElementById("ranking-top-categories");
    const rankLeastCat = document.getElementById("ranking-least-categories");
    const rankHighestEx = document.getElementById("ranking-highest-expense");
    const avgDaily = document.getElementById("avg-daily-expense");
    const avgWeekly = document.getElementById("avg-weekly-expense");
    const avgMonthly = document.getElementById("avg-monthly-expense");

    if (rankTopCat) {
      rankTopCat.textContent = summary.rankings?.topCategory && summary.rankings.topCategory !== "None" ? summary.rankings.topCategory : "None";
    }
    if (rankLeastCat) {
      rankLeastCat.textContent = summary.rankings?.leastCategory && summary.rankings.leastCategory !== "None" ? summary.rankings.leastCategory : "None";
    }
    if (rankHighestEx) {
      rankHighestEx.textContent = summary.rankings?.highestExpense && summary.rankings.highestExpense !== "None" ? summary.rankings.highestExpense : "None";
    }
    if (avgDaily) avgDaily.textContent = formatCurrency(summary.averageDailyExpense || 0);
    if (avgWeekly) avgWeekly.textContent = formatCurrency(summary.averageWeeklyExpense || 0);
    if (avgMonthly) avgMonthly.textContent = formatCurrency(summary.averageMonthlyExpense || 0);

    // 6. Render Suggestions & Tables
    renderSuggestions(summary.suggestions);
    renderLatestExpensesTable(summary.latestExpenses);

    // 7. Draw Charts (All 4 charts!)
    drawCategoryChart(summary.latestExpenses);
    drawDailyTrendChart();
    drawMonthlySpendingChart();
    drawSavingsProgressChart(summary.monthlySalary || 0, summary.savingsGoal || 0, summary.expectedSavings || 0);

  } catch (error) {
    console.error("Dashboard refresh failure:", error);
    showToast("Server communication breakdown.", "error");
  }
}

function renderSuggestions(suggestions) {
  const container = document.getElementById("suggestions-container");
  if (!container) return;

  container.innerHTML = "";
  if (!suggestions || suggestions.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; grid-column: span 2; color: var(--text-muted);">
        <i data-lucide="smile" style="margin: 0 auto 8px; display: block;"></i> No spending advice needed. Looking good!
      </div>
    `;
    lucide.createIcons();
    return;
  }

  suggestions.forEach(tip => {
    const card = document.createElement("div");
    card.className = `suggestion-card ${tip.type}`;

    let iconName = "sparkles";
    if (tip.type === "success") iconName = "check-circle2";
    if (tip.type === "warning") iconName = "alert-triangle";
    if (tip.type === "error") iconName = "alert-circle";
    if (tip.type === "info") iconName = "trending-down";

    card.innerHTML = `
      <div class="suggestion-icon">
        <i data-lucide="${iconName}"></i>
      </div>
      <div class="suggestion-text">${tip.message}</div>
    `;
    container.appendChild(card);
  });
  lucide.createIcons();
}

function renderLatestExpensesTable(expenses) {
  const tbody = document.getElementById("latest-expenses-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (!expenses || expenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <div class="empty-icon"><i data-lucide="info"></i></div>
          <p class="empty-title">No transactions recorded yet</p>
          <p class="empty-desc">Click 'Add Expense' above to create your first balance item.</p>
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  expenses.forEach(ex => {
    const row = document.createElement("tr");
    const formattedDate = new Date(ex.date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    row.innerHTML = `
      <td>
        <div class="tx-title">${escapeHTML(ex.name)}</div>
        <div class="stat-desc" style="margin-top: 2px;">${escapeHTML(ex.description || "No description")}</div>
      </td>
      <td>
        <span class="badge badge-${escapeBadgeClass(ex.category)}">${escapeHTML(ex.category)}</span>
      </td>
      <td class="font-mono text-muted">${formattedDate}</td>
      <td class="tx-amount" style="color: var(--text-primary);">${formatCurrency(ex.amount)}</td>
      <td>
        <div class="tx-actions">
          <button class="btn-action edit" onclick="editExpenseInline(${ex.id})" title="Edit Transaction" aria-label="Edit expense">
            <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
          </button>
          <button class="btn-action delete" onclick="deleteExpenseInline(${ex.id})" title="Delete Transaction" aria-label="Delete expense">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
  lucide.createIcons();
}

// Helper to escape HTML to prevent XSS
function escapeHTML(str) {
  if (!str) return "";
  return str.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeBadgeClass(category) {
  return (category || "Other").replace(/[^a-zA-Z0-9]/g, "");
}

// ================= DASHBOARD CHARTS BINDINGS =================

function drawCategoryChart(latestExpenses) {
  const canvas = document.getElementById("categoryChart");
  if (!canvas) return;

  const placeholder = document.getElementById("no-category-chart");
  
  // Group and compile totals by category from the summary
  // Wait, let's fetch category breakdown specifically or map from raw data
  // Standard way: compute categories of current month
  const currentMonthStr = new Date().toISOString().substring(0, 7); // "YYYY-MM"
  const catTotals = {};

  // If we have data, filter by current month and group
  if (latestExpenses && latestExpenses.length > 0) {
    latestExpenses.forEach(ex => {
      if (ex.date.startsWith(currentMonthStr)) {
        catTotals[ex.category] = (catTotals[ex.category] || 0) + ex.amount;
      }
    });
  }

  const categories = Object.keys(catTotals);
  const dataValues = Object.values(catTotals);

  if (categories.length === 0) {
    canvas.style.display = "none";
    placeholder.style.display = "flex";
    return;
  }

  canvas.style.display = "block";
  placeholder.style.display = "none";

  // ChartJS Color palettes
  const colorPalette = [
    "#4f46e5", "#10b981", "#f59e0b", "#f43f5e", "#6366f1",
    "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#3b82f6"
  ];

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#d1d5db" : "#334155";

  categoryChartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: categories,
      datasets: [{
        data: dataValues,
        backgroundColor: colorPalette.slice(0, categories.length),
        borderColor: isDark ? "#111827" : "#ffffff",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            color: textColor,
            font: {
              family: "'Inter', sans-serif",
              size: 11,
              weight: 500
            },
            padding: 12
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.label}: ${formatCurrency(context.raw)}`;
            }
          }
        }
      },
      cutout: "65%"
    }
  });
}

async function drawDailyTrendChart() {
  const canvas = document.getElementById("dailyTrendChart");
  if (!canvas) return;

  const placeholder = document.getElementById("no-trend-chart");

  try {
    const res = await fetch("/api/charts/daily-trends");
    const data = await res.json();
    if (!res.ok || !data.dates || data.dates.length === 0) {
      canvas.style.display = "none";
      placeholder.style.display = "flex";
      return;
    }

    canvas.style.display = "block";
    placeholder.style.display = "none";

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const textColor = isDark ? "#94a3b8" : "#64748b";
    const gridColor = isDark ? "#1f2937" : "#f1f5f9";

    // Standardize Dates format to "Day X"
    const labels = data.dates.map(dateStr => {
      const day = new Date(dateStr).getDate();
      return `Day ${day}`;
    });

    if (dailyTrendChartInstance) {
      dailyTrendChartInstance.destroy();
    }

    dailyTrendChartInstance = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Cumulative Spending (₹)",
            data: data.cumulativeTotals,
            borderColor: "#6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.08)",
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: "#4f46e5",
            pointBorderColor: "#ffffff",
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return ` Cumulative: ${formatCurrency(context.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: textColor,
              font: { family: "'Inter', sans-serif", size: 10 }
            }
          },
          y: {
            grid: {
              color: gridColor
            },
            ticks: {
              color: textColor,
              font: { family: "'Inter', sans-serif", size: 10 },
              callback: function(value) {
                return "₹" + value;
              }
            }
          }
        }
      }
    });

  } catch (err) {
    console.error("Failed plotting daily trends:", err);
  }
}

async function drawMonthlySpendingChart() {
  const canvas = document.getElementById("monthlySpendingChart");
  if (!canvas) return;

  const placeholder = document.getElementById("no-monthly-chart");

  try {
    const res = await fetch("/api/charts/monthly-trends");
    const data = await res.json();
    if (!res.ok || !data.months || data.months.length === 0) {
      canvas.style.display = "none";
      placeholder.style.display = "flex";
      return;
    }

    canvas.style.display = "block";
    placeholder.style.display = "none";

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const textColor = isDark ? "#94a3b8" : "#64748b";
    const gridColor = isDark ? "#1f2937" : "#f1f5f9";

    // Format YYYY-MM to friendly July 2026 format
    const labels = data.months.map(mStr => {
      const parts = mStr.split("-");
      if (parts.length !== 2) return mStr;
      const year = parts[0];
      const monthIndex = parseInt(parts[1]) - 1;
      const date = new Date(year, monthIndex, 1);
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    });

    if (monthlySpendingChartInstance) {
      monthlySpendingChartInstance.destroy();
    }

    monthlySpendingChartInstance = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Monthly Spending (₹)",
          data: data.spendTotals,
          backgroundColor: "rgba(99, 102, 241, 0.7)",
          hoverBackgroundColor: "var(--primary)",
          borderColor: "var(--primary)",
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return ` Spent: ${formatCurrency(context.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: textColor,
              font: { family: "'Inter', sans-serif", size: 10 }
            }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: "'Inter', sans-serif", size: 10 },
              callback: function(value) {
                return "₹" + value;
              }
            }
          }
        }
      }
    });
  } catch (err) {
    console.error("Failed plotting monthly spending trends:", err);
  }
}

function drawSavingsProgressChart(salary, savingsGoal, actualSavings) {
  const canvas = document.getElementById("savingsProgressChart");
  if (!canvas) return;

  const placeholder = document.getElementById("no-savings-chart");

  if (!salary || !savingsGoal) {
    canvas.style.display = "none";
    placeholder.style.display = "flex";
    return;
  }

  canvas.style.display = "block";
  placeholder.style.display = "none";

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#d1d5db" : "#334155";
  const emptyColor = isDark ? "#1f2937" : "#e2e8f0";

  const cleanSavings = Math.max(0, actualSavings);
  const remaining = Math.max(0, savingsGoal - cleanSavings);

  const dataValues = [cleanSavings, remaining];
  const colors = ["#10b981", emptyColor];

  if (savingsProgressChartInstance) {
    savingsProgressChartInstance.destroy();
  }

  savingsProgressChartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Saved", "Remaining Goal"],
      datasets: [{
        data: dataValues,
        backgroundColor: colors,
        borderColor: isDark ? "#111827" : "#ffffff",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            color: textColor,
            font: { family: "'Inter', sans-serif", size: 11, weight: 500 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.label}: ${formatCurrency(context.raw)}`;
            }
          }
        }
      },
      cutout: "70%"
    }
  });
}

// ================= ACTION HANDLERS =================

function mountDashboardListeners() {
  // Salary and Savings Goal set triggers
  const btnEditSalary = document.getElementById("btn-edit-salary");
  const btnOnboardAdvisor = document.getElementById("advisor-onboarding-banner") ? document.getElementById("btn-onboard-advisor") : null;
  
  const setupAdvisorModalPrefill = () => {
    const rawSalary = document.getElementById("stat-salary") ? document.getElementById("stat-salary").textContent : "0";
    const rawSavings = document.getElementById("stat-savings-goal") ? document.getElementById("stat-savings-goal").textContent : "0";
    
    const salaryVal = parseFloat(rawSalary.replace(/[^0-9.]/g, "")) || 0;
    const savingsVal = parseFloat(rawSavings.replace(/[^0-9.]/g, "")) || 0;
    
    document.getElementById("input-salary-val").value = salaryVal > 0 ? salaryVal : "";
    document.getElementById("input-savings-val").value = savingsVal > 0 ? savingsVal : "";
    
    // Trigger live calculation
    updateCalculatedBudgetPreview();
    openModal("modal-budget");
  };

  if (btnEditSalary) {
    btnEditSalary.addEventListener("click", setupAdvisorModalPrefill);
  }
  if (btnOnboardAdvisor) {
    btnOnboardAdvisor.addEventListener("click", setupAdvisorModalPrefill);
  }

  // Live budget calculation while typing
  const inputSalary = document.getElementById("input-salary-val");
  const inputSavings = document.getElementById("input-savings-val");
  const calculatedBudgetElem = document.getElementById("calculated-spending-budget");

  function updateCalculatedBudgetPreview() {
    if (!calculatedBudgetElem) return;
    const salary = parseFloat(inputSalary.value) || 0;
    const savings = parseFloat(inputSavings.value) || 0;
    const computed = Math.max(0, salary - savings);
    calculatedBudgetElem.textContent = formatCurrency(computed);
  }

  if (inputSalary) inputSalary.addEventListener("input", updateCalculatedBudgetPreview);
  if (inputSavings) inputSavings.addEventListener("input", updateCalculatedBudgetPreview);

  const formBudget = document.getElementById("form-update-budget");
  if (formBudget) {
    formBudget.addEventListener("submit", async (e) => {
      e.preventDefault();
      const salary = parseFloat(inputSalary.value) || 0;
      const savings = parseFloat(inputSavings.value) || 0;
      
      if (isNaN(salary) || salary < 0 || isNaN(savings) || savings < 0) {
        showToast("Please supply valid values for salary and savings.", "error");
        return;
      }

      try {
        const res = await fetch("/api/budget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monthly_salary: salary, savings_goal: savings })
        });
        const data = await res.json();
        if (res.ok) {
          showToast("Financial settings successfully updated!");
          closeModal("modal-budget");
          loadDashboardData();
        } else {
          showToast(data.error || "Failed to update financial settings.", "error");
        }
      } catch (err) {
        showToast("Server request timed out.", "error");
      }
    });
  }

  // Add Custom Category Triggers
  const btnAddCat = document.getElementById("btn-add-category");
  if (btnAddCat) {
    btnAddCat.addEventListener("click", () => {
      document.getElementById("input-cat-name").value = "";
      openModal("modal-category");
    });
  }

  const formCategory = document.getElementById("form-create-category");
  if (formCategory) {
    formCategory.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("input-cat-name").value.trim();
      if (!name) {
        showToast("Category name cannot be blank.", "error");
        return;
      }

      try {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name })
        });
        const data = await res.json();
        if (res.ok) {
          showToast(`Custom category '${name}' activated.`);
          closeModal("modal-category");
          
          // Re-fetch category lists to update modals
          fetchCategoriesList("select-expense-cat");
        } else {
          showToast(data.error || "Failed creating category.", "error");
        }
      } catch (err) {
        showToast("Could not communicate with DB.", "error");
      }
    });
  }

  // Add Expense Trigger
  const btnAddExpense = document.getElementById("btn-add-expense-trigger");
  if (btnAddExpense) {
    btnAddExpense.addEventListener("click", () => {
      resetExpenseModalForCreate();
      openModal("modal-expense");
    });
  }

  const formExpense = document.getElementById("form-save-expense");
  if (formExpense) {
    formExpense.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const id = document.getElementById("input-expense-id").value;
      const name = document.getElementById("input-expense-name").value.trim();
      const amount = parseFloat(document.getElementById("input-expense-amount").value);
      const date = document.getElementById("input-expense-date").value;
      const category = document.getElementById("select-expense-cat").value;
      const description = document.getElementById("textarea-expense-desc").value.trim();

      if (!name || isNaN(amount) || amount <= 0 || !date || !category) {
        showToast("Please provide all required inputs correctly.", "error");
        return;
      }

      const payload = { name, amount, date, category, description };
      const endpoint = id ? `/api/expenses/${id}` : "/api/expenses";
      const method = id ? "PUT" : "POST";

      try {
        const res = await fetch(endpoint, {
          method: method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          showToast(id ? "Transaction updated successfully." : "New expense added successfully.");
          closeModal("modal-expense");
          
          // Refresh workspace
          if (document.getElementById("categoryChart")) {
            loadDashboardData();
          } else {
            loadExpensesRegister();
          }
        } else {
          showToast(data.error || "Error recording expense.", "error");
        }
      } catch (err) {
        showToast("Network request failure.", "error");
      }
    });
  }
}

function resetExpenseModalForCreate() {
  document.getElementById("expense-modal-title").textContent = "Add Expense Record";
  document.getElementById("input-expense-id").value = "";
  document.getElementById("input-expense-name").value = "";
  document.getElementById("input-expense-amount").value = "";
  document.getElementById("textarea-expense-desc").value = "";
  
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("input-expense-date").value = today;
  
  if (currentCategories.length > 0) {
    document.getElementById("select-expense-cat").value = currentCategories[0];
  }
}

// Inline edit triggered from Latest Table or Expenses list
async function editExpenseInline(id) {
  try {
    // Standard approach: since we have the list loaded, find it in states or query from server
    const endpoint = `/api/expenses`;
    const res = await fetch(endpoint);
    const data = await res.json();
    const expense = data.expenses.find(ex => ex.id === id);
    
    if (!expense) {
      showToast("Could not locate transaction record.", "error");
      return;
    }

    // Prefill modal
    document.getElementById("expense-modal-title").textContent = "Update Expense Details";
    document.getElementById("input-expense-id").value = expense.id;
    document.getElementById("input-expense-name").value = expense.name;
    document.getElementById("input-expense-amount").value = expense.amount;
    document.getElementById("input-expense-date").value = expense.date;
    
    // Refresh and sync category selects
    await fetchCategoriesList("select-expense-cat");
    document.getElementById("select-expense-cat").value = expense.category;
    document.getElementById("textarea-expense-desc").value = expense.description || "";

    openModal("modal-expense");
  } catch (err) {
    showToast("Server lookup fail.", "error");
  }
}

async function deleteExpenseInline(id) {
  if (!confirm("Are you sure you want to permanently delete this expense?")) return;

  try {
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      showToast("Transaction deleted.");
      if (document.getElementById("categoryChart")) {
        loadDashboardData();
      } else {
        loadExpensesRegister();
      }
    } else {
      showToast(data.error || "Failed deleting expense.", "error");
    }
  } catch (err) {
    showToast("Server request failed.", "error");
  }
}

// ================= EXPENSES DETAILED REGISTER PAGE LOGIC =================

async function initExpensesPage() {
  console.log("Initializing Detailed Expenses Log Page...");

  // Prefill dates to current month by default
  const todayMonth = new Date().toISOString().substring(0, 7);
  document.getElementById("filter-month").value = todayMonth;

  // Mount expense modal handlers
  mountDashboardListeners();

  // Load custom user categories and sync filter controls
  const categories = await fetchCategoriesList("select-expense-cat");
  
  // Update Filter Category select
  const filterCatSelect = document.getElementById("filter-category");
  if (filterCatSelect) {
    filterCatSelect.innerHTML = `<option value="All">All Categories</option>`;
    categories.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      filterCatSelect.appendChild(option);
    });
  }

  // Update Filter Pills UI
  const pillsContainer = document.getElementById("expenses-category-pills");
  if (pillsContainer) {
    categories.forEach(cat => {
      const pill = document.createElement("div");
      pill.className = "category-pill";
      pill.setAttribute("data-pill-cat", cat);
      pill.textContent = cat;
      pillsContainer.appendChild(pill);
    });
  }

  // Load initially filtered dataset
  await loadExpensesRegister();

  // Mount register specific filters
  mountExpensesRegisterFilters();
}

async function loadExpensesRegister() {
  const search = document.getElementById("search-input").value;
  const category = document.getElementById("filter-category").value;
  const month = document.getElementById("filter-month").value;
  const sort = document.getElementById("sort-select").value;

  const url = new URL("/api/expenses", window.location.origin);
  if (search) url.searchParams.append("search", search);
  if (category && category !== "All") url.searchParams.append("category", category);
  if (month) url.searchParams.append("month", month);
  if (sort) url.searchParams.append("sort", sort);

  try {
    const tbody = document.getElementById("expenses-tbody");
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <i data-lucide="loader-2" class="spinner" style="margin: 0 auto 12px; display: block;"></i>
          <span>Filtering transactional records...</span>
        </td>
      </tr>
    `;
    lucide.createIcons();

    const res = await fetch(url.toString());
    const data = await res.json();
    if (res.ok) {
      allExpensesData = data.expenses;
      expensesCurrentPage = 1; // Reset to page 1 on filter
      renderExpensesRegisterTable();
    } else {
      showToast(data.error || "Failed loading register details.", "error");
    }
  } catch (err) {
    showToast("Network disconnect.", "error");
  }
}

function renderExpensesRegisterTable() {
  const tbody = document.getElementById("expenses-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  const totalItems = allExpensesData.length;

  if (totalItems === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <div class="empty-icon"><i data-lucide="filter-x"></i></div>
          <p class="empty-title">No matching expenses found</p>
          <p class="empty-desc">Try resetting your filters or adjusting your search queries.</p>
        </td>
      </tr>
    `;
    lucide.createIcons();
    
    // Disable pagination buttons
    document.getElementById("btn-pagination-prev").disabled = true;
    document.getElementById("btn-pagination-next").disabled = true;
    document.getElementById("pagination-info-text").textContent = "Showing 0-0 of 0 entries";
    return;
  }

  // Calculate sliding page indexes
  const startIndex = (expensesCurrentPage - 1) * expensesPageSize;
  const endIndex = Math.min(startIndex + expensesPageSize, totalItems);
  const pagedData = allExpensesData.slice(startIndex, endIndex);

  pagedData.forEach(ex => {
    const row = document.createElement("tr");
    const formattedDate = new Date(ex.date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    row.innerHTML = `
      <td>
        <div class="tx-title">${escapeHTML(ex.name)}</div>
        <div class="stat-desc" style="margin-top: 2px;">${escapeHTML(ex.description || "No description")}</div>
      </td>
      <td>
        <span class="badge badge-${escapeBadgeClass(ex.category)}">${escapeHTML(ex.category)}</span>
      </td>
      <td class="font-mono text-muted">${formattedDate}</td>
      <td class="tx-amount" style="color: var(--text-primary);">${formatCurrency(ex.amount)}</td>
      <td>
        <div class="tx-actions">
          <button class="btn-action edit" onclick="editExpenseInline(${ex.id})" title="Edit Record" aria-label="Edit expense">
            <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
          </button>
          <button class="btn-action delete" onclick="deleteExpenseInline(${ex.id})" title="Delete Record" aria-label="Delete expense">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
  lucide.createIcons();

  // Manage Pagination Controls State
  document.getElementById("btn-pagination-prev").disabled = (expensesCurrentPage === 1);
  document.getElementById("btn-pagination-next").disabled = (endIndex >= totalItems);
  document.getElementById("pagination-info-text").textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalItems} entries`;
}

function mountExpensesRegisterFilters() {
  const searchInput = document.getElementById("search-input");
  const filterCat = document.getElementById("filter-category");
  const filterMonth = document.getElementById("filter-month");
  const sortSelect = document.getElementById("sort-select");
  const resetBtn = document.getElementById("btn-reset-filters");

  // Debounced search trigger (300ms delay)
  let searchTimeout = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadExpensesRegister();
    }, 300);
  });

  // Dropdown changes trigger immediate refresh
  filterCat.addEventListener("change", () => {
    syncCategoryDropdownAndPills(filterCat.value);
    loadExpensesRegister();
  });

  filterMonth.addEventListener("change", () => {
    loadExpensesRegister();
  });

  sortSelect.addEventListener("change", () => {
    loadExpensesRegister();
  });

  // Reset filter trigger
  resetBtn.addEventListener("click", () => {
    searchInput.value = "";
    filterCat.value = "All";
    filterMonth.value = new Date().toISOString().substring(0, 7);
    sortSelect.value = "date_desc";
    
    syncCategoryDropdownAndPills("All");
    loadExpensesRegister();
    showToast("Filter criteria cleared.");
  });

  // Pill click triggers
  document.querySelectorAll(".category-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const selectedCat = pill.getAttribute("data-pill-cat");
      syncCategoryDropdownAndPills(selectedCat);
      loadExpensesRegister();
    });
  });

  // Pagination buttons triggers
  document.getElementById("btn-pagination-prev").addEventListener("click", () => {
    if (expensesCurrentPage > 1) {
      expensesCurrentPage--;
      renderExpensesRegisterTable();
    }
  });

  document.getElementById("btn-pagination-next").addEventListener("click", () => {
    const totalItems = allExpensesData.length;
    if (expensesCurrentPage * expensesPageSize < totalItems) {
      expensesCurrentPage++;
      renderExpensesRegisterTable();
    }
  });
}

function syncCategoryDropdownAndPills(categoryName) {
  // Sync the category select dropdown
  const select = document.getElementById("filter-category");
  if (select) select.value = categoryName;

  // Sync active states on pills
  document.querySelectorAll(".category-pill").forEach(pill => {
    if (pill.getAttribute("data-pill-cat") === categoryName) {
      pill.classList.add("active");
    } else {
      pill.classList.remove("active");
    }
  });
}
