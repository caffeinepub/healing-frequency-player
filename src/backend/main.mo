import Principal "mo:core/Principal";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Order "mo:core/Order";
import Array "mo:core/Array";
import Iter "mo:core/Iter";

actor {
  type Session = {
    mood : Text;
    frequencyHz : Nat;
    durationSeconds : Nat;
    timestamp : Int;
  };

  module Session {
    public func compare(session1 : Session, session2 : Session) : Order.Order {
      Int.compare(session1.timestamp, session2.timestamp);
    };
  };

  let sessions = Map.empty<Principal, [Session]>();

  public shared ({ caller }) func logSession(mood : Text, frequencyHz : Nat, durationSeconds : Nat) : async () {
    let newSession : Session = {
      mood;
      frequencyHz;
      durationSeconds;
      timestamp = Time.now();
    };

    let userSessions = switch (sessions.get(caller)) {
      case (null) { [newSession] };
      case (?existingSessions) { existingSessions.concat([newSession]) };
    };

    sessions.add(caller, userSessions);
  };

  public query ({ caller }) func getUserSessions() : async [Session] {
    switch (sessions.get(caller)) {
      case (null) { [] };
      case (?userSessions) { userSessions.sort() };
    };
  };
};
