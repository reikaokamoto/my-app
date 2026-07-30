const form = document.querySelector("#expense-form");
const amountInput = document.querySelector("#amount");
const categoryInput = document.querySelector("#category");
const dateInput = document.querySelector("#date");
const memoInput = document.querySelector("#memo");
const submitButton = document.querySelector("#submit-button");
const formMessage = document.querySelector("#form-message");
const expenseList = document.querySelector("#expense-list");
const expenseCount = document.querySelector("#expense-count");
const monthlyTotal = document.querySelector("#monthly-total");

const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
  .toISOString()
  .slice(0, 10);
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

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "データを取得できませんでした。");
  }

  return data;
};

const renderExpenses = (expenses) => {
  expenseList.replaceChildren();
  expenseCount.textContent = `${expenses.length}件`;

  if (expenses.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = "まだ支出はありません。最初の記録を追加しましょう。";
    expenseList.append(empty);
    return;
  }

  expenses.forEach((expense) => {
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

const loadExpenses = async () => {
  const expenses = await fetchJson("/expenses");
  renderExpenses(expenses);
};

const loadSummary = async () => {
  const month = localToday.slice(0, 7);
  const summary = await fetchJson(`/expenses/summary?month=${month}`);
  monthlyTotal.textContent = formatMoney(summary.total);
};

const showLoadError = () => {
  monthlyTotal.textContent = "取得できませんでした";
  expenseList.innerHTML = '<p class="empty-message error">データを読み込めませんでした。</p>';
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
    await Promise.all([loadExpenses(), loadSummary()]);
    amountInput.focus();
  } catch (error) {
    formMessage.textContent =
      error instanceof Error ? error.message : "登録できませんでした。";
    formMessage.classList.add("error");
  } finally {
    submitButton.disabled = false;
  }
});

Promise.all([loadExpenses(), loadSummary()]).catch(showLoadError);
