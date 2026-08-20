// Show longer context for a question on hover

(function () {
  const Shareabouts_PlaceFormView_events = Shareabouts.PlaceFormView.prototype.events;
  Shareabouts.PlaceFormView.prototype.events = {
    ...Shareabouts_PlaceFormView_events,
    'click .tooltip-icon': 'onClickTooltipIcon',
  };

  Shareabouts.PlaceFormView.prototype.onClickTooltipIcon = function (evt) {
    const iconEl = evt.currentTarget;
    const tooltipId = iconEl.getAttribute('data-tooltip-id');
    const tooltipEl = this.el.querySelector(`#${tooltipId}`);

    tooltipEl.classList.toggle('hidden-if-no-hover');
  }

})();