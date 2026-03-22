import Map "mo:core/Map";
import Principal "mo:core/Principal";

module {
  type OldSession = {
    mood : Text;
    frequencyHz : Nat;
    durationSeconds : Nat;
    timestamp : Int;
  };

  type OldActor = {
    sessions : Map.Map<Principal, [OldSession]>;
  };

  // New trial and premium status types
  type TrialInfo = {
    startTime : Int;
    isActive : Bool;
  };

  type PremiumStatus = {
    isPremium : Bool;
    subscriptionId : Text;
  };

  // New actor type
  type NewActor = {
    sessions : Map.Map<Principal, [OldSession]>;
    trialStatuses : Map.Map<Principal, TrialInfo>;
    premiumStatuses : Map.Map<Principal, PremiumStatus>;
  };

  // Migration function
  public func run(old : OldActor) : NewActor {
    let emptyTrialStatuses = Map.empty<Principal, TrialInfo>();
    let emptyPremiumStatuses = Map.empty<Principal, PremiumStatus>();

    {
      sessions = old.sessions;
      trialStatuses = emptyTrialStatuses;
      premiumStatuses = emptyPremiumStatuses;
    };
  };
};
