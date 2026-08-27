<script setup>

const ballotCollection = window.ballots || new window.Shareabouts.SubmissionCollection({type: 'ballots'});
window.ballots = ballotCollection;
window.ballots.anonymous; // List of anonymous ballot submissions
/*
    [
        {
            "proposals": [
                "proposal1",
                "proposal2",
                "proposal3"
            ]
        },
        {
            "proposals": [
                "proposal2",
                "proposal5",
                "proposal4"
            ]
        }
    ]
*/

const surveyCollection = window.surveys || new window.Shareabouts.SubmissionCollection({type: 'surveys'});
window.surveys = surveyCollection;
window.surveys.anonymous;
</script>