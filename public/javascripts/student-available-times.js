const activityFilter = document.getElementById("activity-filter");
const timeCards = document.querySelectorAll(".available-time-card");

activityFilter.addEventListener("change", function () {
    const selectedActivity = this.value;

    timeCards.forEach(function (card) {
        const cardActivity = card.dataset.activity;

        if (selectedActivity === "" || cardActivity === selectedActivity) {
            card.style.display = "";
        } else {
            card.style.display = "none";
        }
    });
});

const selectButtons = document.querySelectorAll(".select-time-button");

selectButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        document.querySelectorAll(".available-time-card").forEach(function (card) {
            card.classList.remove("selected");
        });

        this.closest(".available-time-card").classList.add("selected");
    });
});