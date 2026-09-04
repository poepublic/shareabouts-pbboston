describe('models.js', function() {

  describe('SubmissionCollection', function() {
    var origPrefix;

    beforeEach(function() {
      Shareabouts.bootstrapped = Shareabouts.bootstrapped || {};
      origPrefix = Shareabouts.bootstrapped.apiPrefix;
      Shareabouts.bootstrapped.apiPrefix = '/api/v2';
    });

    afterEach(function() {
      Shareabouts.bootstrapped.apiPrefix = origPrefix;
    });

    it('resolves place-specific URL when placeModel is provided', function() {
      var place = new Backbone.Model({ id: 123 });
      var collection = new Shareabouts.SubmissionCollection([], {
        submissionType: 'ballots',
        placeModel: place
      });

      expect(collection.url()).toEqual('/api/v2/places/123/ballots');
    });

    it('resolves dataset-level URL when placeModel is omitted', function() {
      var collection = new Shareabouts.SubmissionCollection([], {
        submissionType: 'ballots'
      });

      expect(collection.url()).toEqual('/api/v2/ballots');
    });

    it('throws error when submissionType is missing', function() {
      expect(function() {
        var collection = new Shareabouts.SubmissionCollection([], {});
        collection.url();
      }).toThrow();
    });

    it('exposes a dataset-level anonymous AnonymousCollection sub-collection', function() {
      var collection = new Shareabouts.SubmissionCollection([], {
        submissionType: 'ballots'
      });

      expect(collection.anonymous).toBeDefined();
      expect(collection.anonymous instanceof Shareabouts.AnonymousCollection).toBe(true);
      expect(collection.anonymous.url()).toEqual('/api/v2/ballots/anonymous');
    });

    it('exposes dataset-level anonymous sub-collection even when placeModel is provided', function() {
      var place = new Backbone.Model({ id: 456 });
      var collection = new Shareabouts.SubmissionCollection([], {
        submissionType: 'surveys',
        placeModel: place
      });

      expect(collection.anonymous.url()).toEqual('/api/v2/surveys/anonymous');
    });
  });

  describe('PlaceCollection', function() {
    var origPrefix;

    beforeEach(function() {
      Shareabouts.bootstrapped = Shareabouts.bootstrapped || {};
      origPrefix = Shareabouts.bootstrapped.apiPrefix;
      Shareabouts.bootstrapped.apiPrefix = '/api/v2';
    });

    afterEach(function() {
      Shareabouts.bootstrapped.apiPrefix = origPrefix;
    });

    it('exposes an anonymous AnonymousCollection sub-collection for places', function() {
      var places = new Shareabouts.PlaceCollection([]);

      expect(places.anonymous).toBeDefined();
      expect(places.anonymous instanceof Shareabouts.AnonymousCollection).toBe(true);
      expect(places.anonymous.url()).toEqual('/api/v2/places/anonymous');
    });
  });

  describe('PlaceModel', function() {
    var origPrefix;

    beforeEach(function() {
      Shareabouts.bootstrapped = Shareabouts.bootstrapped || {};
      origPrefix = Shareabouts.bootstrapped.apiPrefix;
      Shareabouts.bootstrapped.apiPrefix = '/api/v2';
    });

    afterEach(function() {
      Shareabouts.bootstrapped.apiPrefix = origPrefix;
    });

    it('initializes anonymous collections on submissionSets resolving to dataset anonymous endpoint', function() {
      var place = new Shareabouts.PlaceModel({
        id: 789,
        submission_sets: {
          ballots: []
        }
      });

      expect(place.submissionSets.ballots).toBeDefined();
      expect(place.submissionSets.ballots.anonymous).toBeDefined();
      expect(place.submissionSets.ballots.anonymous.url()).toEqual('/api/v2/ballots/anonymous');
    });
  });

  describe('AnonymousCollection', function() {
    var origPrefix;

    beforeEach(function() {
      Shareabouts.bootstrapped = Shareabouts.bootstrapped || {};
      origPrefix = Shareabouts.bootstrapped.apiPrefix;
      Shareabouts.bootstrapped.apiPrefix = '/api/v2';
    });

    afterEach(function() {
      Shareabouts.bootstrapped.apiPrefix = origPrefix;
    });

    it('resolves dataset-level anonymous endpoint for submissionType', function() {
      var anonBallots = new Shareabouts.AnonymousCollection([], {
        submissionType: 'ballots'
      });
      expect(anonBallots.url()).toEqual('/api/v2/ballots/anonymous');

      var anonPlaces = new Shareabouts.AnonymousCollection([], {});
      expect(anonPlaces.url()).toEqual('/api/v2/places/anonymous');
    });

    it('parses results and metadata from anonymous API response', function() {
      var anonCollection = new Shareabouts.AnonymousCollection([], {
        submissionType: 'ballots'
      });

      var rawResponse = {
        metadata: {
          length: 2,
          page: 1,
          num_pages: 1,
          next: null
        },
        results: [
          { proposals: ['p1', 'p2'] },
          { proposals: ['p3'] }
        ]
      };

      var parsed = anonCollection.parse(rawResponse);

      expect(anonCollection.metadata).toEqual(rawResponse.metadata);
      expect(parsed.length).toEqual(2);
      expect(parsed[0].proposals).toEqual(['p1', 'p2']);

      anonCollection.reset(parsed);
      expect(anonCollection.models.length).toEqual(2);
      expect(anonCollection.at(0).get('proposals')).toEqual(['p1', 'p2']);
      expect(anonCollection.at(1).get('proposals')).toEqual(['p3']);
    });
  });

});
