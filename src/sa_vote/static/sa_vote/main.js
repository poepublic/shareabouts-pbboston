import { Router } from './routes.js';

Handlebars.registerHelper('currency', function (amount) { // for formatting proposal costs on ballot page
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  });

window.app = new Router();