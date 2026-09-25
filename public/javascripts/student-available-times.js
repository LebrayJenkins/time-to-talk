const activityFilter = document.getElementById("activity-filter");
const timeCards = document.querySelectorAll(".available-time-card");
const selectButtons = document.querySelectorAll(".select-time-button");
const selectedTimeInput = document.getElementById("selected-time-id");
const continueButton = document.getElementById("continue-booking-button");

activityFilter.addEventListener("change", function () {
  const selectedActivity = this.value;

  timeCards.forEach(function (card) {
    const matches =
      selectedActivity === "" || card.dataset.activity === selectedActivity;

    card.style.display = matches ? "" : "none";

    // Om den valda tiden döljs måste eleven välja en ny tid.
    if (!matches && card.classList.contains("selected")) {
      card.classList.remove("selected");
      card
        .querySelector(".select-time-button")
        .setAttribute("aria-pressed", "false");
      selectedTimeInput.value = "";
      continueButton.disabled = true;
    }
  });
});

selectButtons.forEach(function (button) {
  button.setAttribute("aria-pressed", "false");

  button.addEventListener("click", function () {
    timeCards.forEach(function (card) {
      card.classList.remove("selected");
      card
        .querySelector(".select-time-button")
        .setAttribute("aria-pressed", "false");
    });

    this.closest(".available-time-card").classList.add("selected");
    this.setAttribute("aria-pressed", "true");

    selectedTimeInput.value = this.dataset.timeId;
    continueButton.disabled = false;

    document.addEventListener("click", function (event) {
      // Behåll valet när eleven klickar på en tid eller på Fortsätt.
      if (
        event.target.closest(".available-time-card, #continue-booking-form")
      ) {
        return;
      }

      timeCards.forEach(function (card) {
        card.classList.remove("selected");
        card
          .querySelector(".select-time-button")
          .setAttribute("aria-pressed", "false");
      });

      selectedTimeInput.value = "";
      continueButton.disabled = true;
    });
  });
});
