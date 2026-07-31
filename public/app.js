const form = document.querySelector("#expense-form");
const amountInput = document.querySelector("#amount");
const categoryInput = document.querySelector("#category");
const dateInput = document.querySelector("#date");
const memoInput = document.querySelector("#memo");
const submitButton = document.querySelector("#submit-button");
const formMessage = document.querySelector("#form-message");
const expenseList = document.querySelector("#expense-list");
const expenseCount = document.querySelector("#expense-count");
const expenseMonthTabs = document.querySelector("#expense-month-tabs");
const monthlyTotal = document.querySelector("#monthly-total");
const donutRing = document.querySelector("#donut-ring");
const categoryLegend = document.querySelector("#category-legend");
const chartMonth = document.querySelector("#chart-month");
const monthlyChart = document.querySelector("#monthly-chart");
const monthlyLegend = document.querySelector("#monthly-legend");
const monthlyCard = document.querySelector(".monthly-card");
const listCard = document.querySelector(".list-card");

const CATEGORY_COLORS = {
  食費: "#ff8a65",
  交通費: "#4db6ac",
  日用品: "#ffd54f",
  娯楽: "#ab79d6",
  光熱費: "#42a5f5",
  その他: "#f06292",
};
const FALLBACK_COLORS = ["#ffb74d", "#4dd0e1", "#81c784", "#ba68c8"];

const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
  .toISOString()
  .slice(0, 10);
const currentMonth = localToday.slice(0, 7);
let selectedExpenseMonth = currentMonth;

dateInput.value = localToday;

const formatMoney = (amount) =>
  new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (date) => {
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${year}/${month}/${day}`;
};

const formatMonth = (month) => {
  const [year, monthNumber] = month.split("-");
  return `${year}年${Number(monthNumber)}月`;
};

const getCategoryColor = (category) => {
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];

  const colorIndex = [...category].reduce(
    (total, character) => total + character.codePointAt(0),
    0,
  );
  return FALLBACK_COLORS[colorIndex % FALLBACK_COLORS.length];
};

const getRecentMonths = () =>
  [2, 1, 0].map((monthsAgo) => {
    const date = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });

const getExpenseMonths = (expenses) => {
  const recordedMonths = expenses
    .map((expense) => expense.date.slice(0, 7))
    .filter((month) => /^\d{4}-\d{2}$/.test(month));
  const boundaryMonths = [...recordedMonths, currentMonth].sort();
  const [firstMonth] = boundaryMonths;
  const lastMonth = boundaryMonths.at(-1);
  const [firstYear, firstMonthNumber] = firstMonth.split("-").map(Number);
  const [lastYear, lastMonthNumber] = lastMonth.split("-").map(Number);
  const firstIndex = firstYear * 12 + firstMonthNumber - 1;
  const lastIndex = lastYear * 12 + lastMonthNumber - 1;
  const months = [];

  for (let index = lastIndex; index >= firstIndex; index -= 1) {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }

  return months;
};

const summarizeByCategory = (expenses, month) => {
  const totals = new Map();

  expenses
    .filter((expense) => expense.date.slice(0, 7) === month)
    .forEach((expense) => {
      totals.set(
        expense.category,
        (totals.get(expense.category) ?? 0) + expense.amount,
      );
    });

  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort(
      (first, second) =>
        second.amount - first.amount ||
        first.category.localeCompare(second.category, "ja"),
    );
};

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "データを取得できませんでした。");
  }

  return data;
};

const createLegendItem = ({ category, amount }, showAmount = true) => {
  const item = document.createElement("div");
  item.className = "legend-item";

  const dot = document.createElement("span");
  dot.className = "legend-dot";
  dot.style.backgroundColor = getCategoryColor(category);

  const label = document.createElement("span");
  label.textContent = category;

  item.append(dot, label);

  if (showAmount) {
    const value = document.createElement("strong");
    value.textContent = formatMoney(amount);
    item.append(value);
  }

  return item;
};

const renderExpenseItems = (expenses) => {
  const monthExpenses = expenses
    .filter((expense) => expense.date.slice(0, 7) === selectedExpenseMonth)
    .sort(
      (first, second) =>
        second.date.localeCompare(first.date) ||
        Number(second.id ?? 0) - Number(first.id ?? 0),
    );

  expenseList.replaceChildren();
  expenseCount.textContent = `${monthExpenses.length}件`;
  expenseList.setAttribute(
    "aria-label",
    `${formatMonth(selectedExpenseMonth)}の支出`,
  );

  if (monthExpenses.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = "記録がありません。";
    expenseList.append(empty);
    return;
  }

  monthExpenses.forEach((expense) => {
    const item = document.createElement("article");
    item.className = "expense-item";

    const details = document.createElement("div");
    details.className = "expense-details";

    const category = document.createElement("strong");
    category.textContent = expense.category;

    const meta = document.createElement("p");
    meta.textContent = expense.memo
      ? `${formatDate(expense.date)} ・ ${expense.memo}`
      : formatDate(expense.date);

    const amount = document.createElement("span");
    amount.className = "expense-amount";
    amount.textContent = formatMoney(expense.amount);

    details.append(category, meta);
    item.append(details, amount);
    expenseList.append(item);
  });
};

const renderExpenses = (expenses) => {
  const months = getExpenseMonths(expenses);

  if (!months.includes(selectedExpenseMonth)) {
    selectedExpenseMonth = months[0];
  }

  expenseMonthTabs.replaceChildren();

  months.forEach((month) => {
    const tab = document.createElement("button");
    const isSelected = month === selectedExpenseMonth;

    tab.type = "button";
    tab.className = "expense-month-tab";
    tab.textContent = formatMonth(month);
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(isSelected));
    tab.classList.toggle("is-active", isSelected);

    tab.addEventListener("click", () => {
      selectedExpenseMonth = month;
      renderExpenses(expenses);
      expenseMonthTabs
        .querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });

    expenseMonthTabs.append(tab);
  });

  renderExpenseItems(expenses);
};

const renderDonut = (expenses) => {
  const categories = summarizeByCategory(expenses, currentMonth);
  const total = categories.reduce((sum, category) => sum + category.amount, 0);

  chartMonth.textContent = formatMonth(currentMonth);
  monthlyTotal.textContent = formatMoney(total);
  categoryLegend.replaceChildren();

  if (total === 0) {
    donutRing.style.background = "conic-gradient(#e5eae6 0 100%)";
    const empty = document.createElement("p");
    empty.className = "legend-empty";
    empty.textContent = "今月の支出はまだありません。";
    categoryLegend.append(empty);
    return;
  }

  let startAngle = 0;
  const segments = categories.map(({ category, amount }) => {
    const segmentAngle = (amount / total) * 360;
    const endAngle = startAngle + segmentAngle;
    const separatorAngle = Math.min(0.6, segmentAngle * 0.15);
    const colorEndAngle = endAngle - separatorAngle;
    const segment =
      `${getCategoryColor(category)} ${startAngle}deg ${colorEndAngle}deg, ` +
      `#fff ${colorEndAngle}deg ${endAngle}deg`;
    startAngle = endAngle;
    return segment;
  });

  donutRing.style.background = `conic-gradient(${segments.join(", ")})`;
  categories.forEach((category) =>
    categoryLegend.append(createLegendItem(category)),
  );
};

const renderMonthlyChart = (expenses) => {
  const months = getRecentMonths();
  const summaries = months.map((month) => {
    const categories = summarizeByCategory(expenses, month);
    return {
      month,
      categories,
      total: categories.reduce((sum, category) => sum + category.amount, 0),
    };
  });
  const maxTotal = Math.max(...summaries.map(({ total }) => total), 1);

  monthlyChart.replaceChildren();
  monthlyLegend.replaceChildren();

  summaries.forEach(({ month, categories, total }) => {
    const monthBar = document.createElement("div");
    monthBar.className = "month-bar";

    const totalLabel = document.createElement("span");
    totalLabel.className = "bar-total";
    totalLabel.textContent = formatMoney(total);

    const track = document.createElement("div");
    track.className = "bar-track";

    const stack = document.createElement("div");
    stack.className = "bar-stack";
    stack.setAttribute(
      "aria-label",
      `${formatMonth(month)}の支出合計 ${formatMoney(total)}`,
    );

    categories.forEach(({ category, amount }) => {
      const segment = document.createElement("div");
      segment.className = "bar-segment";
      segment.style.height = `${(amount / maxTotal) * 100}%`;
      segment.style.backgroundColor = getCategoryColor(category);
      segment.title = `${category}: ${formatMoney(amount)}`;
      stack.append(segment);
    });

    const monthLabel = document.createElement("span");
    monthLabel.className = "month-label";
    monthLabel.textContent = formatMonth(month);

    track.append(stack);
    monthBar.append(totalLabel, track, monthLabel);
    monthlyChart.append(monthBar);
  });

  const usedCategories = [
    ...new Set(
      summaries.flatMap(({ categories }) =>
        categories.map(({ category }) => category),
      ),
    ),
  ];
  usedCategories.forEach((category) =>
    monthlyLegend.append(createLegendItem({ category, amount: 0 }, false)),
  );
};

const alignListCardHeight = () => {
  listCard.style.height = "";

  if (window.matchMedia("(max-width: 720px)").matches) return;

  window.requestAnimationFrame(() => {
    const monthlyBottom = monthlyCard.getBoundingClientRect().bottom;
    const listTop = listCard.getBoundingClientRect().top;
    listCard.style.height = `${Math.max(monthlyBottom - listTop, 320)}px`;
  });
};

const loadDashboard = async () => {
  const expenses = await fetchJson("/expenses");
  renderExpenses(expenses);
  renderDonut(expenses);
  renderMonthlyChart(expenses);
  alignListCardHeight();
};

const showLoadError = () => {
  monthlyTotal.textContent = "取得できませんでした";
  expenseList.innerHTML =
    '<p class="empty-message error">データを読み込めませんでした。</p>';
  monthlyChart.innerHTML =
    '<p class="empty-message error">グラフを読み込めませんでした。</p>';
  alignListCardHeight();
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  formMessage.textContent = "";
  formMessage.className = "form-message";

  try {
    await fetchJson("/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(amountInput.value),
        category: categoryInput.value,
        date: dateInput.value,
        memo: memoInput.value,
      }),
    });

    amountInput.value = "";
    categoryInput.value = "";
    memoInput.value = "";
    formMessage.textContent = "支出を記録しました。";
    formMessage.classList.add("success");
    await loadDashboard();
    amountInput.focus();
  } catch (error) {
    formMessage.textContent =
      error instanceof Error ? error.message : "登録できませんでした。";
    formMessage.classList.add("error");
  } finally {
    submitButton.disabled = false;
  }
});

window.addEventListener("resize", alignListCardHeight);
loadDashboard().catch(showLoadError);
