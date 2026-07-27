// Voting trends
function initVoteGraph() {

  const votes = [2, 5, 1, 2, 3, 2, 1, 3, 1, 5,
    2, 8, 2, 13, 3, 4, 1, 9, 2, 11,
    2, 3, 11, 4, 1, 19, 1, 7, 5, 4,
    1, 4, 3, 3, 6, 4, 1, 3, 1, 8,
    11, 2, 1, 7, 1, 4, 1, 2, 12, 4,
    1, 11, 1, 5, 8, 5, 1, 5, 13, 2,
    1, 9, 14];
  const lastIndex = votes.length - 1;


  bb.generate({
    padding: {
      left: 50,
    },
    data: {
      x: "x",
      columns: [
        ["x", "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10",
              "2026-01-11", "2026-01-12", "2026-01-13", "2026-01-14", "2026-01-15", "2026-01-16", "2026-01-17", "2026-01-18", "2026-01-19", "2026-01-20",
              "2026-01-21", "2026-01-22", "2026-01-23", "2026-01-24", "2026-01-25", "2026-01-26", "2026-01-27", "2026-01-28", "2026-01-29", "2026-01-30",
              "2026-01-31", "2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05", "2026-02-06", "2026-02-07", "2026-02-08", "2026-02-09",
              "2026-02-10", "2026-02-11", "2026-02-12", "2026-02-13", "2026-02-14", "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19",
              "2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23", "2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27", "2026-02-28", "2026-03-01",
              "2026-03-02", "2026-03-03", "2026-03-04"],
        ["votes", ...votes],
      ],
      type: "line",
      colors: {
        votes: "#FF1E71", 
      },
      labels: {
        format: function (v, id, i) {
          return i === lastIndex ? v + "\nVotes" : "";
        }
      }
    },
    axis: {
      x: {
        type: "timeseries",
        tick: {
          values: ["2026-1-0", "2026-1-15", "2026-2-1", "2026-2-15",  "2026-3-1"],
          format: "%b %d",
        }
      },
      y: {
        tick: {
          values: [5, 10, 15, 20],
        }
      }
    },
    legend: {
      show: false
    },
    point: {
      show: false
    },
    bindto: "#overview-graph"
  });
}

// Race
function initRaceGraph() {
bb.generate({
  padding: {
    left: 100,
  },
  data: {
    order: "asc",
    columns: [
	["White", 65, 45],
	["Latinx", 20, 26],
  ["Black/African American", 5, 12],
	["Asian/Pacific Islander", 4, 9],
  ["Other", 3, 6],
    ],
    type: "bar", 
    groups: [
      [
        "White",
        "Latinx",
        "Black/African American",
        "Asian/Pacific Islander",
        "Other"
      ]
    ],
    colors: {
      "White": "var(--iia-urban-pink)",
      "Latinx": "var(--iia-callout-blue",
      "Black/African American": "var(--iia-vibrant-green)",
      "Asian/Pacific Islander": "var(--iia-electric-purple",
      "Other": "var(--iia-fog-grey)"
    },
  },
  axis: {
    rotated: true,
    x: {
      show: true,
      type: "category",
      categories: ["Voters", "Boston"],
    },
    y: {
      show: false,
    }
  },
  bar: {
    padding: 1,
    radius: {
      ratio: 0.2,
    },
    width: {
      max: 65,
    },
  },
  grid: {
    y: {
      lines: [
        {
          value: 0
        }
      ]
    }
  },
  bindto: "#race-graph"
});
}


export { initVoteGraph, initRaceGraph };