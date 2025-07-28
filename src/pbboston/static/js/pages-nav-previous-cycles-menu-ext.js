(function(S) {
  const PagesNavView__render = S.PagesNavView.prototype.render;
  S.PagesNavView.prototype.render = function() {
    PagesNavView__render.apply(this, arguments);

    // This just exists to fill the space in the header menu item and the drop
    // down sub menu for CSS hover purposes.
    let $pastCyclesMenuFiller = this.$('#past-cycles-menu-filler');
    if ($pastCyclesMenuFiller.length === 0) {
      $pastCyclesMenuFiller = $('<div id="past-cycles-menu-filler"/>')
        .insertAfter(this.$('.menu-item-past-cycles > a:first-child'));
    }

    return this;
  }
}(Shareabouts));
