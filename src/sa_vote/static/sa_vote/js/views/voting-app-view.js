import { HomeView } from './home-view.js';
import { BallotView } from './ballot-view.js';
import { FaqView } from './faq-view.js';
import { AuthView } from './auth-view.js';

const MOCK_BALLOT = { // to do: replace with ballot info in md files
  proposals: [
    { slug: 'new-playground-equipment', title: 'New Playground Equipment at Franklin Park', image_alt: 'Children on a playground', amount: 450000, description: 'Replace aging play structures with accessible, all-ages playground equipment and rubberized safety surfacing.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg'},
    { slug: 'protected-bike-lanes', title: 'Protected Bike Lanes on Blue Hill Ave', image_alt: 'Bikers using a protected bikelane', amount: 1200000, description: 'Add physically separated bike lanes and upgraded crosswalks along a one-mile stretch of Blue Hill Avenue.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'roxbury-library-renovation', title: 'Roxbury Branch Library Renovation', image_alt: 'People reading in a library', amount: 800000, description: 'Upgrade HVAC, lighting, and accessibility features at the Roxbury branch of the Boston Public Library.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'community-garden', title: 'Community Garden Expansion', image_alt: 'Senior citizens gardening', amount: 150000, description: 'Add raised beds, a tool shed, and a rainwater collection system to three neighborhood community gardens.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'led-streetlights', title: 'LED Streetlight Replacement', image_alt: 'LED streetlight on a city street', amount: 60000, description: 'Replace aging streetlights with energy-efficient LED fixtures to improve visibility and reduce energy costs.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'public-art', title: 'Public Art Installation', image_alt: 'Colorful mural on a building wall', amount: 100000, description: 'Commission local artists to create murals and sculptures in public spaces to enhance community identity and pride.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'bus-shelters', title: 'Bus Shelter Upgrades', image_alt: 'People waiting at a bus shelter', amount: 200000, description: 'Install new bus shelters with seating, lighting, and real-time arrival information at key transit stops.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'community-centers', title: 'Community Center Renovation', image_alt: 'People participating in activities at a community center', amount: 500000, description: 'Renovate the local community center to include new meeting rooms, a fitness area, and updated technology for community programs.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'street-trees', title: 'Street Tree Planting Program', image_alt: 'Newly planted street trees along a sidewalk', amount: 300000, description: 'Plant new street trees and maintain existing ones to improve air quality, provide shade, and enhance neighborhood aesthetics.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'traffic-calming', title: 'Traffic Calming Measures', image_alt: 'Speed bumps on a residential street', amount: 250000, description: 'Implement traffic calming measures such as speed bumps, curb extensions, and pedestrian islands to improve safety in residential areas.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'recycling-program', title: 'Enhanced Recycling Program', image_alt: 'Recycling bins in a public area', amount: 100000, description: 'Expand recycling services to include more materials and provide educational programs to encourage community participation.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'public-wifi', title: 'Public Wi-Fi Expansion', image_alt: 'People using laptops in a public park', amount: 150000, description: 'Install public Wi-Fi hotspots in parks and community centers to improve internet access for residents.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
  ],
};

const FAQs = {
  sections: [
    {
      title: "Voting in this cycle",
      questions: [
        { question: "Who can vote in this cycle?", answer: "All residents of the city who are 18 years or older and registered to vote are eligible to participate in this cycle." },
        { question: "How do I submit my vote?", answer: "You can submit your vote online through our secure voting platform after registering to vote." },
        { question: "Can I change my vote after submitting it?", answer: "No, once your vote is submitted, it cannot be changed. Please review your choices carefully before finalizing your vote." },
        { question: "When will the results be announced?", answer: "The results will be announced on the official election website and through local media outlets after the voting period ends." },
        { question: "Is my vote public?", answer: "No, all votes are confidential and will not be disclosed to the public. Your privacy is protected throughout the voting process." },
      ],
    },
    {
      title: "About Ideas in Action (IIA)",
      questions: [
        { question: "What is Ideas in Action (IIA)?", answer: "Ideas in Action (IIA) is a community-driven initiative that allows residents to propose and vote on projects that will improve their neighborhoods." },
        { question: "How are projects selected for the ballot?", answer: "Projects are selected based on community input, feasibility, and alignment with city priorities. A committee reviews proposals and determines which ones will be included on the ballot." },
        { question: "What is participatory budgeting?", answer: "Participatory budgeting is a democratic process in which community members directly decide how to allocate a portion of the public budget for local projects and initiatives." },
      ],
    },
  ],
};

const verified = Shareabouts.bootstrapped.voterVerified;


export const VotingAppView = Backbone.View.extend({
  initialize: function (options) {
    this.router = options.router;

    // Intercept internal link clicks and route them through Backbone navigate method
    $(document).on('click', 'a[data-internal="true"]', (evt) => {
      if (evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey) return;

      evt.preventDefault();

      var href = $(evt.currentTarget).attr('href'),
          fragment = href.replace(Shareabouts.bootstrapped.routePrefix, '').replace(/^\//, '');

      this.router.navigate(fragment, { trigger: true });

      $('nav.access').removeClass('is-exposed');
    });
  },

  showHome: function () {
    if (this.currentView) {
      this.currentView.remove();
    } 

    this.currentView = new HomeView().render();
    this.el.append(this.currentView.el);
  },

  showBallot: function () {
    if (this.currentView) {
      this.currentView.remove();
    }

    this.currentView = new BallotView({ballot: MOCK_BALLOT, verified: verified}).render();
    this.el.append(this.currentView.el);
  },

  showFaq: function () {
    if (this.currentView) {
      this.currentView.remove();
    } 

    this.currentView = new FaqView({faqs: FAQs}).render();
    this.el.append(this.currentView.el);
  },

  showAuth: function () {
    if (this.currentView) {
      this.currentView.remove();
    } 

    this.currentView = new AuthView({verified: verified}).render();
    this.el.append(this.currentView.el);
  },
});
