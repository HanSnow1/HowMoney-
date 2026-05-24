(function () {
  "use strict";

  var VALID_VIEWS = ["home", "calendar", "mypage"];
  var VIEW_TITLES = {
    home: "PROSERVICES — 홈",
    calendar: "PROSERVICES — 달력",
    mypage: "PROSERVICES — 마이페이지",
  };

  initNavigation();
  initPayCalculator();

  function initNavigation() {
    var views = document.querySelectorAll(".view[data-view]");
    var navLinks = document.querySelectorAll("[data-view]:not(.view)");
    var modal = document.getElementById("result-modal");
    var scheduleModal = document.getElementById("schedule-modal");

    if (!views.length) {
      return;
    }

    function closeOpenModals() {
      if (modal && !modal.hidden) {
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
      }

      if (scheduleModal && !scheduleModal.hidden) {
        scheduleModal.hidden = true;
        scheduleModal.setAttribute("aria-hidden", "true");
      }

      document.body.style.overflow = "";
    }

    function switchView(viewName, updateHash) {
      if (VALID_VIEWS.indexOf(viewName) === -1) {
        viewName = "home";
      }

      views.forEach(function (view) {
        var isActive = view.dataset.view === viewName;
        view.hidden = !isActive;
      });

      navLinks.forEach(function (link) {
        var isActive = link.dataset.view === viewName;
        link.classList.toggle("active", isActive);

        if (isActive) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      });

      if (VIEW_TITLES[viewName]) {
        document.title = VIEW_TITLES[viewName];
      }

      if (updateHash !== false && window.location.hash !== "#" + viewName) {
        history.replaceState(null, "", "#" + viewName);
      }

      closeOpenModals();

      if (viewName === "home" && window.HowMoney && window.HowMoney.refreshHomeSummaries) {
        window.HowMoney.refreshHomeSummaries();
      }

      window.scrollTo(0, 0);
    }

    navLinks.forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        switchView(link.dataset.view);
      });
    });

    window.addEventListener("hashchange", function () {
      var viewName = window.location.hash.replace("#", "");
      switchView(viewName, false);
    });

    var initialView = window.location.hash.replace("#", "");
    switchView(initialView || "home", false);
  }

  function initPayCalculator() {
  var MIN_WAGE_2026 = 10320;
  var WEEKS_PER_MONTH = 52 / 12;

  var INSURANCE_RATES = {
    pension: 0.045,
    health: 0.03545,
    longTermCare: 0.03545 * 0.1295,
    employment: 0.009,
  };

  var form = document.getElementById("pay-calc-form");
  var modal = document.getElementById("result-modal");
  var hourlyWageInput = document.getElementById("hourly-wage");
  var minWageWarning = document.getElementById("min-wage-warning");
  var advancedToggle = document.getElementById("calc-advanced-toggle");
  var advancedPanel = document.getElementById("calc-advanced-panel");

  if (!form || !modal) {
    return;
  }

  function parseNumber(value) {
    var digits = String(value).replace(/[^\d.]/g, "");
    var parsed = parseFloat(digits);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function formatNumber(value) {
    return Math.round(value).toLocaleString("ko-KR");
  }

  function formatMoney(value) {
    return formatNumber(value) + "원";
  }

  function formatInputValue(input) {
    var value = parseNumber(input.value);
    if (Number.isFinite(value) && value >= 0) {
      input.value = formatNumber(value);
    }
  }

  function updateMinWageWarning() {
    var hourlyWage = parseNumber(hourlyWageInput.value);
    var isBelowMin = Number.isFinite(hourlyWage) && hourlyWage < MIN_WAGE_2026;
    minWageWarning.hidden = !isBelowMin;
  }

  function getRadioValue(name) {
    var selected = form.querySelector('input[name="' + name + '"]:checked');
    return selected ? selected.value : "";
  }

  function isWeeklyHolidayEligible(weeklyHours, weeklyDays, businessSize) {
    return businessSize === "over5" && weeklyHours >= 15 && weeklyDays > 0;
  }

  function calculateInsuranceDeduction(grossPay) {
    var pension = grossPay * INSURANCE_RATES.pension;
    var health = grossPay * INSURANCE_RATES.health;
    var longTermCare = grossPay * INSURANCE_RATES.longTermCare;
    var employment = grossPay * INSURANCE_RATES.employment;
    var total = pension + health + longTermCare + employment;

    return {
      total: total,
      items: [
        { label: "국민연금 (4.5%)", amount: pension },
        { label: "건강보험 (3.545%)", amount: health },
        { label: "장기요양보험", amount: longTermCare },
        { label: "고용보험 (0.9%)", amount: employment },
      ],
    };
  }

  function calculatePayroll(input) {
    var weeklyHolidayEligible = isWeeklyHolidayEligible(
      input.weeklyHours,
      input.weeklyDays,
      input.businessSize
    );

    var basePay = input.hourlyWage * input.weeklyHours * WEEKS_PER_MONTH;
    var weeklyHolidayPay = weeklyHolidayEligible
      ? input.hourlyWage * (input.weeklyHours / input.weeklyDays) * WEEKS_PER_MONTH
      : 0;
    var overtimePay =
      input.hourlyWage * 1.5 * input.overtimeHours * WEEKS_PER_MONTH;
    var nightPay =
      input.hourlyWage * 0.5 * input.nightHours * WEEKS_PER_MONTH;
    var holidayPay =
      input.hourlyWage * 0.5 * input.holidayHours * WEEKS_PER_MONTH;

    var grossPay =
      basePay + weeklyHolidayPay + overtimePay + nightPay + holidayPay;

    var deduction;
    var netPay;
    var deductionItems = [];

    if (input.deductionType === "withholding") {
      deduction = grossPay * 0.033;
      netPay = grossPay - deduction;
      deductionItems.push({ label: "3.3% 원천징수", amount: deduction });
    } else {
      var insurance = calculateInsuranceDeduction(grossPay);
      deduction = insurance.total;
      netPay = grossPay - deduction;
      deductionItems = insurance.items;
    }

    var notes = [];

    if (input.hourlyWage < MIN_WAGE_2026) {
      notes.push("입력하신 시급이 2026년 최저시급(10,320원)보다 낮습니다.");
    }

    if (input.businessSize === "under5") {
      notes.push("5인 미만 사업장은 주휴수당 의무 지급 대상이 아닙니다.");
    } else if (input.weeklyHours < 15) {
      notes.push("주 15시간 미만 근무 시 주휴수당이 발생하지 않습니다.");
    }

    if (input.deductionType === "insurance") {
      notes.push(
        "4대보험은 간이 요율 기준이며, 실제 공제액은 소득·가입 여부에 따라 달라질 수 있습니다."
      );
    }

    return {
      basePay: basePay,
      weeklyHolidayPay: weeklyHolidayPay,
      overtimePay: overtimePay,
      nightPay: nightPay,
      holidayPay: holidayPay,
      grossPay: grossPay,
      netPay: netPay,
      deduction: deduction,
      deductionItems: deductionItems,
      weeklyHolidayEligible: weeklyHolidayEligible,
      notes: notes,
    };
  }

  function validateForm() {
    var hourlyWage = parseNumber(hourlyWageInput.value);
    var weeklyHours = parseNumber(document.getElementById("weekly-hours").value);
    var weeklyDays = parseNumber(document.getElementById("weekly-days").value);
    var overtimeHours = parseNumber(
      document.getElementById("overtime-hours").value
    );
    var nightHours = parseNumber(document.getElementById("night-hours").value);
    var holidayHours = parseNumber(
      document.getElementById("holiday-hours").value
    );

    if (!Number.isFinite(hourlyWage) || hourlyWage <= 0) {
      alert("시급을 올바르게 입력해 주세요.");
      hourlyWageInput.focus();
      return null;
    }

    if (!Number.isFinite(weeklyHours) || weeklyHours <= 0) {
      alert("주당 근무시간을 올바르게 입력해 주세요.");
      document.getElementById("weekly-hours").focus();
      return null;
    }

    if (!Number.isFinite(weeklyDays) || weeklyDays <= 0 || weeklyDays > 7) {
      alert("주당 근무일수는 1~7일 사이로 입력해 주세요.");
      document.getElementById("weekly-days").focus();
      return null;
    }

    var extraHours = [
      { value: overtimeHours, label: "연장 근무" },
      { value: nightHours, label: "야간 근무" },
      { value: holidayHours, label: "휴일 근무" },
    ];

    for (var i = 0; i < extraHours.length; i += 1) {
      var item = extraHours[i];
      if (!Number.isFinite(item.value) || item.value < 0) {
        alert(item.label + " 시간을 올바르게 입력해 주세요.");
        return null;
      }
    }

    return {
      hourlyWage: hourlyWage,
      weeklyHours: weeklyHours,
      weeklyDays: weeklyDays,
      overtimeHours: overtimeHours || 0,
      nightHours: nightHours || 0,
      holidayHours: holidayHours || 0,
      businessSize: getRadioValue("businessSize"),
      deductionType: getRadioValue("deductionType"),
    };
  }

  function renderBreakdown(breakdownEl, result, input) {
    var items = [
      { label: "기본급", amount: result.basePay },
      {
        label: "주휴수당",
        amount: result.weeklyHolidayPay,
        hidden: !result.weeklyHolidayEligible,
      },
      {
        label: "연장수당 (×1.5)",
        amount: result.overtimePay,
        hidden: input.overtimeHours <= 0,
      },
      {
        label: "야간수당 (+50%)",
        amount: result.nightPay,
        hidden: input.nightHours <= 0,
      },
      {
        label: "휴일수당 (+50%)",
        amount: result.holidayPay,
        hidden: input.holidayHours <= 0,
      },
      { label: "세전 합계", amount: result.grossPay, emphasize: true },
    ];

    breakdownEl.innerHTML = "";

    items.forEach(function (item) {
      if (item.hidden) {
        return;
      }

      var dt = document.createElement("dt");
      dt.textContent = item.label;

      var dd = document.createElement("dd");
      dd.textContent = formatMoney(item.amount);
      if (item.emphasize) {
        dd.style.color = "var(--color-primary)";
      }

      breakdownEl.appendChild(dt);
      breakdownEl.appendChild(dd);
    });

    result.deductionItems.forEach(function (item) {
      var dt = document.createElement("dt");
      dt.textContent = item.label;

      var dd = document.createElement("dd");
      dd.textContent = "-" + formatMoney(item.amount);
      dd.style.color = "#dc2626";

      breakdownEl.appendChild(dt);
      breakdownEl.appendChild(dd);
    });
  }

  function renderConditions(listEl, input, result) {
    var businessLabel =
      input.businessSize === "over5" ? "5인 이상 사업장" : "5인 미만 사업장";
    var deductionLabel =
      input.deductionType === "withholding"
        ? "3.3% 원천징수"
        : "4대보험 공제";

    var conditions = [
      "시급 " + formatMoney(input.hourlyWage),
      "주당 " + formatNumber(input.weeklyHours) + "시간 · " + formatNumber(input.weeklyDays) + "일 근무",
      businessLabel,
      deductionLabel,
      "월 환산: 주급 × " + WEEKS_PER_MONTH.toFixed(3) + "주",
    ];

    if (input.overtimeHours > 0) {
      conditions.push("연장 근무 주 " + formatNumber(input.overtimeHours) + "시간");
    }
    if (input.nightHours > 0) {
      conditions.push("야간 근무 주 " + formatNumber(input.nightHours) + "시간");
    }
    if (input.holidayHours > 0) {
      conditions.push("휴일 근무 주 " + formatNumber(input.holidayHours) + "시간");
    }
    if (result.weeklyHolidayEligible) {
      conditions.push("주휴수당 적용 (주 15시간 이상, 5인 이상)");
    }

    listEl.innerHTML = "";
    conditions.forEach(function (text) {
      var li = document.createElement("li");
      li.textContent = text;
      listEl.appendChild(li);
    });
  }

  function openModal(input, result) {
    document.getElementById("modal-net-pay").textContent = formatMoney(result.netPay);
    document.getElementById("modal-gross-pay").textContent = formatMoney(result.grossPay);

    renderBreakdown(document.getElementById("modal-breakdown"), result, input);
    renderConditions(document.getElementById("modal-conditions"), input, result);

    var notesEl = document.getElementById("modal-notes");
    notesEl.textContent = result.notes.join(" ");

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function toggleAdvancedPanel() {
    if (!advancedToggle || !advancedPanel) {
      return;
    }

    var isOpen = advancedToggle.getAttribute("aria-expanded") === "true";
    advancedToggle.setAttribute("aria-expanded", String(!isOpen));
    advancedPanel.hidden = isOpen;
  }

  if (advancedToggle && advancedPanel) {
    advancedToggle.addEventListener("click", toggleAdvancedPanel);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var input = validateForm();
    if (!input) {
      return;
    }

    var result = calculatePayroll(input);
    openModal(input, result);
  });

  hourlyWageInput.addEventListener("input", updateMinWageWarning);

  form.querySelectorAll(".calc-input").forEach(function (input) {
    input.addEventListener("blur", function () {
      formatInputValue(input);
      if (input === hourlyWageInput) {
        updateMinWageWarning();
      }
    });
  });

  modal.querySelectorAll("[data-close-modal]").forEach(function (element) {
    element.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  updateMinWageWarning();
  }
})();
