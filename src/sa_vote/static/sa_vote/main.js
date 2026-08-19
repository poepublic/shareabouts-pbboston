import { Router } from './routes.js';

Handlebars.registerHelper('currency', function (amount) { // for formatting proposal costs on ballot page
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
});


Handlebars.registerHelper('randomize', function (array) { // randomize the order of proposals on ballot page with fisher-yates algorithm (https://javascript.info/task/shuffle)
    if (!Array.isArray(array)) {
        return array;
        }

    const shuffled = array.slice();
    for (let i = shuffled.length - 1; i > 0; i--) { // 
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
});


window.app = new Router();
