const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp(functions.config().firebase);

var db = admin.firestore();

function scheduleTransaction(date, reoccurance) {
  switch (reoccurance) {
    case "Day": {
      const newDate = new Date(date);
      newDate.setDate(date.getDate() + 1);
      return newDate;
    }

    case "Week": {
      const newDate = new Date(date);
      newDate.setDate(date.getDate() + 1);
      return newDate;
    }

    case "Month": {
      const newDate = new Date(date);
      newDate.setMonth(date.getMonth() + 1);
      return newDate;
    }
  }

  throw new Error("bad reoccurance!");
}

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

exports.scheduleRequest = functions.https.onRequest(function(_, response) {
  const transactionsRef = db.collection("transactions");
  const scheduledTransactionsRef = db.collection("scheduledTransactions");
  const logRef = db.collection("log");

  scheduledTransactionsRef
    .get()
    .then(function(scheduledTransactionsQuerySnapshot) {
      scheduledTransactionsQuerySnapshot.forEach(function(doc) {
        let st = doc.data();
        let nextRun = st.nextRun ? st.nextRun : st.startingDate;
        nextRun.setHours(0, 0, 0, 0);
        let promises = [];

        // run it then schedule
        if (nextRun.getTime() < Date.now()) {
          console.log("Scheduling " + st.transaction.name);
          // its past the time now, add the transaction in
          promises.push(
            transactionsRef
              .doc()
              .set(Object.assign({}, st.transaction, { date: nextRun }))
              .then(function() {
                console.log(
                  "Added transactions " +
                    st.transaction.name +
                    ". Re-scheduling it..."
                );
                let nextOne = scheduleTransaction(nextRun, st.every);
                console.log(
                  "Scheduling " + st.transaction.name + " for " + nextOne
                );
                return Promise.all([
                  scheduledTransactionsRef
                    .doc(doc.id)
                    .set(Object.assign({}, st, { nextRun: nextOne })),
                  logRef.doc().set({
                    event: "Added transaction " + st.transaction.name,
                    transaction: st.transaction
                  })
                ]);
              })
          );
        } else {
          console.log(
            "Skipping " +
              st.transaction.name +
              ". Reason: " +
              nextRun +
              " > " +
              new Date()
          );
        }

        return Promise.all(promises);
      });
    })
    .then(function() {
      return response.send("Done");
    })
    .catch(function() {
      return response.status(500).send("Oh no. Check the log");
    });
});
