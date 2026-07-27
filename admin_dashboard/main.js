import { initVoteGraph, initRaceGraph } from './votes-graph.js';
import { initVotesMap} from './votes-by-neigh-map.js?v=cachebust1';

initVoteGraph();
initVotesMap();
initRaceGraph();