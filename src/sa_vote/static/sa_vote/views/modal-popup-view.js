const noop = () => {};

export const ModalPopupView = Backbone.View.extend({
  el: '#modal-popup',

  events: {
    'cancel': 'onCancel',
    'close': 'onClose',
    'click [data-action="close"]': 'close',
    'click [data-action="cancel"]': 'cancel',
  },

  initialize: function(options) {
    this.options = options || {};
  },

  render: function() {
    this.el.innerHTML = this.options.content || '';
    return this;
  },

  show: function() {
    this.render();
    this.el.showModal();
    return this;
  },

  close: function() {
    this.el.close();
    return this;
  },

  cancel: function() {
    this.el.requestClose();
    return this;
  },

  onCancel: function(evt) {
    (this.options.cancel || noop)(evt);
  },

  onClose: function(evt) {
    (this.options.close || noop)(evt);
  }
});

export const showModalPopup = (options) => {
  const view = new ModalPopupView(options);
  return view.show();
};
