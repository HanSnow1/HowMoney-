(function () {
  "use strict";

  var STORAGE_KEY = "howmoney_schedules";
  var MIN_WAGE_2026 = 10320;
  var TYPE_LABELS = {
    work: "알바",
    personal: "개인",
    todo: "할 일",
  };

  var calendarGrid = document.getElementById("calendar-grid");
  var monthLabel = document.getElementById("cal-month-label");
  var selectedDateLabel = document.getElementById("selected-date-label");
  var scheduleList = document.getElementById("schedule-list");
  var scheduleForm = document.getElementById("schedule-form");
  var scheduleModal = document.getElementById("schedule-modal");

  if (!calendarGrid || !scheduleForm || !scheduleModal) {
    return;
  }

  var currentMonth = new Date();
  currentMonth.setDate(1);
  var selectedDate = formatDateKey(new Date());
  var schedules = loadSchedules();
  var editingId = null;

  function loadSchedules() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveSchedules() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
    renderCalendar();
    renderSelectedDateSchedules();
    updateHomeSummaries();
  }

  function formatDateKey(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function parseDateKey(key) {
    var parts = key.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function getScheduleEndDate(item) {
    if (item.type === "personal" && item.endDate) {
      return item.endDate;
    }

    return item.date;
  }

  function scheduleIncludesDate(item, dateKey) {
    var endDate = getScheduleEndDate(item);

    if (item.type === "personal" && endDate > item.date) {
      return dateKey >= item.date && dateKey <= endDate;
    }

    return item.date === dateKey;
  }

  function formatShortDate(key) {
    var date = parseDateKey(key);
    return date.getMonth() + 1 + "월 " + date.getDate() + "일";
  }

  function formatScheduleDateLabel(item) {
    var endDate = getScheduleEndDate(item);

    if (item.type === "personal" && endDate > item.date) {
      return formatShortDate(item.date) + " ~ " + formatShortDate(endDate);
    }

    return "";
  }

  function formatMonthLabel(date) {
    return date.getFullYear() + "년 " + (date.getMonth() + 1) + "월";
  }

  function formatDisplayDate(key) {
    var date = parseDateKey(key);
    var weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return date.getMonth() + 1 + "월 " + date.getDate() + "일 (" + weekdays[date.getDay()] + ")";
  }

  function parseTimeToMinutes(time) {
    var parts = time.split(":");
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function isOvernightShift(startTime, endTime) {
    if (!startTime || !endTime) {
      return false;
    }

    return parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime);
  }

  function formatTimeRange(item) {
    if (item.startTime && item.endTime) {
      if (isOvernightShift(item.startTime, item.endTime)) {
        return item.startTime + " ~ 익일 " + item.endTime;
      }
      return item.startTime + " ~ " + item.endTime;
    }
    if (item.startTime) {
      return item.startTime + "부터";
    }
    return "시간 미정";
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
    return formatNumber(Math.round(value)) + "원";
  }

  function formatHours(hours) {
    var rounded = Math.round(hours * 10) / 10;
    if (Number.isInteger(rounded)) {
      return rounded + "시간";
    }
    return rounded.toFixed(1) + "시간";
  }

  function getEffectiveHourlyWage(item) {
    if (item.type !== "work") {
      return null;
    }

    if (item.hourlyWage && item.hourlyWage > 0) {
      return item.hourlyWage;
    }

    return MIN_WAGE_2026;
  }

  function formatWageLabel(item) {
    var wage = getEffectiveHourlyWage(item);

    if (!wage) {
      return "";
    }

    if (!item.hourlyWage || item.hourlyWage <= 0 || item.usesMinimumWage) {
      return "시급 " + formatNumber(wage) + "원 (최저시급)";
    }

    return "시급 " + formatNumber(wage) + "원";
  }

  function resolveWorkHourlyWage(wageValue) {
    if (Number.isFinite(wageValue) && wageValue > 0) {
      return wageValue;
    }

    return MIN_WAGE_2026;
  }

  function getWorkHours(item) {
    if (!item.startTime || !item.endTime) {
      return null;
    }

    var startMinutes = parseTimeToMinutes(item.startTime);
    var endMinutes = parseTimeToMinutes(item.endTime);
    var diff = endMinutes - startMinutes;

    if (diff <= 0) {
      diff += 24 * 60;
    }

    if (diff <= 0) {
      return null;
    }

    return diff / 60;
  }

  function getWorkPay(item) {
    var hours = getWorkHours(item);
    var wage = getEffectiveHourlyWage(item);

    if (hours === null || !wage) {
      return null;
    }

    return {
      hours: hours,
      pay: hours * wage,
      wage: wage,
    };
  }

  function calculateTodayDailyPay() {
    var workItems = getTodaySchedules().filter(function (item) {
      return item.type === "work";
    });

    var totalPay = 0;
    var totalHours = 0;
    var calculatedCount = 0;
    var skippedNoTime = 0;

    workItems.forEach(function (item) {
      var hours = getWorkHours(item);

      if (hours === null) {
        skippedNoTime += 1;
        return;
      }

      var wage = getEffectiveHourlyWage(item);
      totalPay += hours * wage;
      totalHours += hours;
      calculatedCount += 1;
    });

    return {
      totalPay: totalPay,
      totalHours: totalHours,
      workCount: workItems.length,
      calculatedCount: calculatedCount,
      skippedNoTime: skippedNoTime,
      items: workItems,
    };
  }

  function getTodayWorkPayBreakdown() {
    return getTodaySchedules()
      .filter(function (item) {
        return item.type === "work";
      })
      .map(function (item) {
        var hours = getWorkHours(item);
        var wage = getEffectiveHourlyWage(item);
        var pay = hours !== null && wage ? hours * wage : null;

        return {
          item: item,
          hours: hours,
          pay: pay,
          wage: wage,
        };
      })
      .sort(function (a, b) {
        if (a.item.startTime && b.item.startTime) {
          return a.item.startTime.localeCompare(b.item.startTime);
        }
        return a.item.title.localeCompare(b.item.title, "ko");
      });
  }

  function createHomePayItemElement(entry) {
    var li = document.createElement("li");
    li.className = "home-pay-item";

    var main = document.createElement("div");
    main.className = "home-pay-item-main";

    var title = document.createElement("p");
    title.className = "home-pay-item-title";
    title.textContent = entry.item.title;

    var meta = document.createElement("p");
    meta.className = "home-pay-item-meta";
    meta.textContent = formatTimeRange(entry.item);

    if (entry.hours !== null) {
      meta.textContent += " · " + formatHours(entry.hours);
    }

    if (entry.wage) {
      meta.textContent += " · " + formatWageLabel(entry.item);
    }

    main.appendChild(title);
    main.appendChild(meta);
    li.appendChild(main);

    var amount = document.createElement("span");
    amount.className = "home-pay-item-amount";
    amount.textContent = entry.pay !== null ? formatMoney(entry.pay) : "—";
    li.appendChild(amount);

    return li;
  }

  function compareSchedules(a, b) {
    if (a.startTime && b.startTime && a.startTime !== b.startTime) {
      return a.startTime.localeCompare(b.startTime);
    }
    if (a.startTime && !b.startTime) {
      return -1;
    }
    if (!a.startTime && b.startTime) {
      return 1;
    }
    return a.title.localeCompare(b.title, "ko");
  }

  function getSchedulesByDate(dateKey) {
    return schedules
      .filter(function (item) {
        return scheduleIncludesDate(item, dateKey);
      })
      .sort(compareSchedules);
  }

  function getTodaySchedules() {
    return getSchedulesByDate(formatDateKey(new Date()));
  }

  function renderCalendar() {
    var year = currentMonth.getFullYear();
    var month = currentMonth.getMonth();
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var todayKey = formatDateKey(new Date());

    monthLabel.textContent = formatMonthLabel(currentMonth);
    calendarGrid.innerHTML = "";

    for (var i = 0; i < firstDay; i += 1) {
      var emptyCell = document.createElement("div");
      emptyCell.className = "calendar-cell calendar-cell-empty";
      emptyCell.setAttribute("aria-hidden", "true");
      calendarGrid.appendChild(emptyCell);
    }

    for (var day = 1; day <= daysInMonth; day += 1) {
      var dateKey = formatDateKey(new Date(year, month, day));
      var daySchedules = getSchedulesByDate(dateKey);
      var button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-cell";
      button.dataset.date = dateKey;
      button.setAttribute("aria-label", day + "일, 일정 " + daySchedules.length + "건");

      if (dateKey === todayKey) {
        button.classList.add("is-today");
      }

      if (dateKey === selectedDate) {
        button.classList.add("is-selected");
      }

      if (daySchedules.length > 0) {
        button.classList.add("has-events");
      }

      var dayNumber = document.createElement("span");
      dayNumber.className = "calendar-day";
      dayNumber.textContent = String(day);
      button.appendChild(dayNumber);

      if (daySchedules.length > 0) {
        var dots = document.createElement("span");
        dots.className = "calendar-dots";
        daySchedules.slice(0, 3).forEach(function (item) {
          var dot = document.createElement("span");
          dot.className = "calendar-dot calendar-dot-" + item.type;
          dots.appendChild(dot);
        });
        button.appendChild(dots);
      }

      button.addEventListener("click", function () {
        selectDate(this.dataset.date);
      });

      calendarGrid.appendChild(button);
    }
  }

  function selectDate(dateKey) {
    selectedDate = dateKey;
    renderCalendar();
    renderSelectedDateSchedules();
  }

  function renderSelectedDateSchedules() {
    var items = getSchedulesByDate(selectedDate);
    selectedDateLabel.textContent = formatDisplayDate(selectedDate) + " 일정";
    scheduleList.innerHTML = "";

    if (!items.length) {
      var empty = document.createElement("li");
      empty.className = "schedule-empty";
      empty.textContent = "등록된 일정이 없습니다. 일정을 추가해 보세요.";
      scheduleList.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      scheduleList.appendChild(createScheduleItemElement(item, true));
    });
  }

  function createScheduleItemElement(item, showActions) {
    var li = document.createElement("li");
    li.className = "schedule-item schedule-item-" + item.type;
    if (item.type === "todo" && item.completed) {
      li.classList.add("is-completed");
    }

    if (isOvernightShift(item.startTime, item.endTime)) {
      li.classList.add("is-overnight");
    }

    var main = document.createElement("div");
    main.className = "schedule-item-main";

    var badge = document.createElement("span");
    badge.className = "schedule-type-badge";
    badge.textContent = TYPE_LABELS[item.type] || item.type;

    var title = document.createElement("p");
    title.className = "schedule-item-title";
    title.textContent = item.title;

    var meta = document.createElement("p");
    meta.className = "schedule-item-meta";

    var dateLabel = formatScheduleDateLabel(item);
    if (dateLabel) {
      meta.textContent = dateLabel;
    }

    var timeRange = formatTimeRange(item);
    if (timeRange !== "시간 미정" || item.type === "todo") {
      if (meta.textContent) {
        meta.textContent += " · ";
      }
      meta.textContent += timeRange;
    } else if (!meta.textContent) {
      meta.textContent = timeRange;
    }

    if (item.type === "work") {
      var workPay = getWorkPay(item);
      if (workPay) {
        meta.textContent += " · 예상 " + formatMoney(workPay.pay);
        meta.textContent += " · " + formatWageLabel(item);
      }
    }

    if (item.memo) {
      meta.textContent += " · " + item.memo;
    }

    main.appendChild(badge);
    main.appendChild(title);
    main.appendChild(meta);
    li.appendChild(main);

    if (showActions) {
      var actions = document.createElement("div");
      actions.className = "schedule-item-actions";

      if (item.type === "todo") {
        var completeBtn = document.createElement("button");
        completeBtn.type = "button";
        completeBtn.className = "schedule-action-btn";
        completeBtn.textContent = item.completed ? "취소" : "완료";
        completeBtn.addEventListener("click", function () {
          toggleTodoComplete(item.id);
        });
        actions.appendChild(completeBtn);
      }

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "schedule-action-btn";
      editBtn.textContent = "수정";
      editBtn.addEventListener("click", function () {
        openScheduleModal(item);
      });
      actions.appendChild(editBtn);

      li.appendChild(actions);
    }

    return li;
  }

  function updateHomePaySummary() {
    var valueEl = document.getElementById("today-pay-value");
    var descEl = document.getElementById("today-pay-desc");
    var listEl = document.getElementById("home-today-pay-list");

    if (!valueEl || !descEl) {
      return;
    }

    var result = calculateTodayDailyPay();
    var breakdown = getTodayWorkPayBreakdown();

    if (listEl) {
      listEl.innerHTML = "";
    }

    if (result.workCount === 0) {
      valueEl.textContent = "—";
      descEl.textContent = "오늘 알바 일정 없음";
      if (listEl) {
        listEl.hidden = true;
      }
      return;
    }

    if (result.calculatedCount === 0) {
      valueEl.textContent = "—";
      descEl.textContent = "근무 시간을 입력하면 일급이 계산됩니다";

      if (listEl) {
        listEl.hidden = false;
        breakdown.forEach(function (entry) {
          listEl.appendChild(createHomePayItemElement(entry));
        });
      }
      return;
    }

    valueEl.textContent = formatMoney(result.totalPay);

    var descParts = [
      "스케줄 기준 세전 일급",
      "알바 " + result.calculatedCount + "건",
      "총 " + formatHours(result.totalHours),
    ];

    if (result.skippedNoTime > 0) {
      descParts.push("미계산 " + result.skippedNoTime + "건");
    }

    descEl.textContent = descParts.join(" · ");

    if (listEl) {
      listEl.hidden = false;
      breakdown.forEach(function (entry) {
        listEl.appendChild(createHomePayItemElement(entry));
      });
    }
  }

  function updateHomeSummaries() {
    updateHomeScheduleSummary();
    updateHomePaySummary();
  }

  function updateHomeScheduleSummary() {
    var todayItems = getTodaySchedules();
    var valueEl = document.getElementById("today-schedule-value");
    var descEl = document.getElementById("today-schedule-desc");
    var listEl = document.getElementById("home-today-schedules");

    if (!valueEl || !descEl || !listEl) {
      return;
    }

    valueEl.textContent = todayItems.length + "건";

    if (!todayItems.length) {
      descEl.textContent = "등록된 일정이 없습니다";
      listEl.hidden = true;
      listEl.innerHTML = "";
      return;
    }

    var first = todayItems[0];
    descEl.textContent = formatTimeRange(first) + " · " + first.title;

    listEl.hidden = false;
    listEl.innerHTML = "";
    todayItems.slice(0, 3).forEach(function (item) {
      listEl.appendChild(createScheduleItemElement(item, false));
    });

    if (todayItems.length > 3) {
      var more = document.createElement("li");
      more.className = "home-schedule-more";
      more.textContent = "외 " + (todayItems.length - 3) + "건";
      listEl.appendChild(more);
    }
  }

  function updateTypeFields() {
    var type = document.getElementById("schedule-type").value;
    var wageField = document.getElementById("schedule-wage-field");
    var timeRow = document.querySelector(".schedule-time-row");
    var endDateField = document.getElementById("schedule-end-date-field");
    var dateLabel = document.getElementById("schedule-date-label");
    var startDateInput = document.getElementById("schedule-date");
    var endDateInput = document.getElementById("schedule-end-date");
    var isPersonal = type === "personal";

    wageField.hidden = type !== "work";
    timeRow.hidden = type === "todo";
    endDateField.hidden = !isPersonal;
    dateLabel.textContent = isPersonal ? "시작일" : "날짜";

    if (isPersonal && startDateInput.value) {
      endDateInput.min = startDateInput.value;
      if (!endDateInput.value || endDateInput.value < startDateInput.value) {
        endDateInput.value = startDateInput.value;
      }
    }
  }

  function openScheduleModal(item) {
    editingId = item ? item.id : null;
    document.getElementById("schedule-modal-title").textContent = item
      ? "일정 수정"
      : "일정 추가";
    document.getElementById("schedule-id").value = item ? item.id : "";
    document.getElementById("schedule-type").value = item ? item.type : "work";
    document.getElementById("schedule-title").value = item ? item.title : "";
    document.getElementById("schedule-date").value = item
      ? item.date
      : selectedDate;
    document.getElementById("schedule-end-date").value =
      item && item.type === "personal" ? getScheduleEndDate(item) : selectedDate;
    document.getElementById("schedule-start").value = item ? item.startTime || "" : "";
    document.getElementById("schedule-end").value = item ? item.endTime || "" : "";
    document.getElementById("schedule-wage").value =
      item && item.hourlyWage && !item.usesMinimumWage
        ? formatNumber(item.hourlyWage)
        : "";
    document.getElementById("schedule-memo").value = item ? item.memo || "" : "";
    document.getElementById("schedule-delete-btn").hidden = !item;

    updateTypeFields();
    scheduleModal.hidden = false;
    scheduleModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    document.getElementById("schedule-title").focus();
  }

  function closeScheduleModal() {
    scheduleModal.hidden = true;
    scheduleModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    editingId = null;
    scheduleForm.reset();
  }

  function validateScheduleForm() {
    var type = document.getElementById("schedule-type").value;
    var title = document.getElementById("schedule-title").value.trim();
    var date = document.getElementById("schedule-date").value;
    var endDate = document.getElementById("schedule-end-date").value;
    var startTime = document.getElementById("schedule-start").value;
    var endTime = document.getElementById("schedule-end").value;
    var wageValue = parseNumber(document.getElementById("schedule-wage").value);
    var memo = document.getElementById("schedule-memo").value.trim();

    if (!title) {
      alert("제목을 입력해 주세요.");
      return null;
    }

    if (!date) {
      alert("날짜를 선택해 주세요.");
      return null;
    }

    if (type === "personal") {
      endDate = endDate || date;
      if (endDate < date) {
        alert("종료일은 시작일보다 빠를 수 없습니다.");
        return null;
      }
      if (endDate === date) {
        endDate = null;
      }
    } else {
      endDate = null;
    }

    if (type !== "todo" && startTime && endTime && startTime === endTime) {
      alert("시작과 종료 시간이 같습니다.");
      return null;
    }

    var overnight =
      type !== "todo" && isOvernightShift(startTime, endTime);
    var userProvidedWage = Number.isFinite(wageValue) && wageValue > 0;
    var hourlyWage =
      type === "work" ? resolveWorkHourlyWage(wageValue) : null;

    return {
      id: editingId || "sch_" + Date.now(),
      type: type,
      title: title,
      date: date,
      endDate: endDate,
      startTime: type === "todo" ? "" : startTime,
      endTime: type === "todo" ? "" : endTime,
      overnight: overnight,
      hourlyWage: hourlyWage,
      usesMinimumWage: type === "work" && !userProvidedWage,
      memo: memo,
      completed: false,
    };
  }

  function saveScheduleFromForm() {
    var payload = validateScheduleForm();
    if (!payload) {
      return;
    }

    if (editingId) {
      var existing = schedules.find(function (item) {
        return item.id === editingId;
      });
      if (existing && existing.type === "todo") {
        payload.completed = existing.completed;
      }

      schedules = schedules.map(function (item) {
        return item.id === editingId ? payload : item;
      });
    } else {
      schedules.push(payload);
    }

    selectedDate = payload.date;
    saveSchedules();
    closeScheduleModal();
  }

  function deleteSchedule() {
    if (!editingId) {
      return;
    }

    if (!confirm("이 일정을 삭제할까요?")) {
      return;
    }

    schedules = schedules.filter(function (item) {
      return item.id !== editingId;
    });
    saveSchedules();
    closeScheduleModal();
  }

  function toggleTodoComplete(id) {
    schedules = schedules.map(function (item) {
      if (item.id !== id) {
        return item;
      }
      return Object.assign({}, item, { completed: !item.completed });
    });
    saveSchedules();
  }

  document.getElementById("cal-prev").addEventListener("click", function () {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById("cal-next").addEventListener("click", function () {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  });

  document.getElementById("cal-today").addEventListener("click", function () {
    var today = new Date();
    currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    selectDate(formatDateKey(today));
  });

  document.getElementById("add-schedule-btn").addEventListener("click", function () {
    openScheduleModal(null);
  });

  document.getElementById("schedule-type").addEventListener("change", updateTypeFields);

  document.getElementById("schedule-date").addEventListener("change", function () {
    if (document.getElementById("schedule-type").value === "personal") {
      updateTypeFields();
    }
  });

  scheduleForm.addEventListener("submit", function (event) {
    event.preventDefault();
    saveScheduleFromForm();
  });

  document.getElementById("schedule-delete-btn").addEventListener("click", deleteSchedule);

  scheduleModal.querySelectorAll("[data-close-schedule-modal]").forEach(function (element) {
    element.addEventListener("click", closeScheduleModal);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !scheduleModal.hidden) {
      closeScheduleModal();
    }
  });

  renderCalendar();
  renderSelectedDateSchedules();
  updateHomeSummaries();

  window.HowMoney = window.HowMoney || {};
  window.HowMoney.refreshHomeSummaries = updateHomeSummaries;
})();
