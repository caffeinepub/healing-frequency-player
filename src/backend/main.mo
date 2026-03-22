import Principal "mo:core/Principal";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Order "mo:core/Order";
import Array "mo:core/Array";
import Iter "mo:core/Iter";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";
import Stripe "stripe/stripe";
import OutCall "http-outcalls/outcall";
import Migration "migration";

(with migration = Migration.run)
actor {
  // Authorization
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // User Profile
  public type UserProfile = {
    name : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Session data structure
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

  // Trial management
  type TrialInfo = {
    startTime : Int;
    isActive : Bool;
  };

  // Payment integration
  type PremiumStatus = {
    isPremium : Bool;
    subscriptionId : Text;
  };

  // Persistent store
  let sessions = Map.empty<Principal, [Session]>();
  let trialStatuses = Map.empty<Principal, TrialInfo>();
  let premiumStatuses = Map.empty<Principal, PremiumStatus>();

  public shared ({ caller }) func logSession(mood : Text, frequencyHz : Nat, durationSeconds : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can log sessions");
    };

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
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get sessions");
    };

    switch (sessions.get(caller)) {
      case (null) { [] };
      case (?userSessions) { userSessions.sort() };
    };
  };

  public shared ({ caller }) func initializeTrial() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can initialize trial");
    };

    if (not trialStatuses.containsKey(caller)) {
      let trialInfo : TrialInfo = {
        startTime = Time.now();
        isActive = true;
      };
      trialStatuses.add(caller, trialInfo);
    };
  };

  public shared ({ caller }) func getTrialStatus() : async ?TrialInfo {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get trial status");
    };

    switch (trialStatuses.get(caller)) {
      case (null) { null };
      case (?trialInfo) {
        if (trialInfo.isActive) {
          let trialDuration = 7 * 24 * 60 * 60 * 1_000_000_000; // 7 days in nanoseconds
          let currentTime = Time.now();
          if (currentTime - trialInfo.startTime > trialDuration) {
            let updatedTrialInfo = {
              trialInfo with isActive = false;
            };
            trialStatuses.add(caller, updatedTrialInfo);
            ?updatedTrialInfo;
          } else {
            ?trialInfo;
          };
        } else {
          ?trialInfo;
        };
      };
    };
  };

  public shared ({ caller }) func upgradeToPremium(subscriptionId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can upgrade to premium");
    };

    let premiumStatus : PremiumStatus = {
      isPremium = true;
      subscriptionId;
    };

    premiumStatuses.add(caller, premiumStatus);
  };

  public query ({ caller }) func checkPremiumStatus() : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can check premium status");
    };

    switch (premiumStatuses.get(caller)) {
      case (null) { false };
      case (?premiumStatus) { premiumStatus.isPremium };
    };
  };

  // Stripe integration fields and functions
  var stripeConfiguration : ?Stripe.StripeConfiguration = null;

  public query ({ caller }) func isStripeConfigured() : async Bool {
    // Allow all authenticated users (including guests) to check if Stripe is configured
    stripeConfiguration != null;
  };

  public shared ({ caller }) func setStripeConfiguration(config : Stripe.StripeConfiguration) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can configure Stripe");
    };
    stripeConfiguration := ?config;
  };

  func getStripeConfiguration() : Stripe.StripeConfiguration {
    switch (stripeConfiguration) {
      case (null) { Runtime.trap("Stripe must be configured first") };
      case (?value) { value };
    };
  };

  public shared ({ caller }) func getStripeSessionStatus(sessionId : Text) : async Stripe.StripeSessionStatus {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get Stripe session status");
    };
    await Stripe.getSessionStatus(getStripeConfiguration(), sessionId, transform);
  };

  public shared ({ caller }) func createCheckoutSession(items : [Stripe.ShoppingItem], successUrl : Text, cancelUrl : Text) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create checkout sessions");
    };
    await Stripe.createCheckoutSession(getStripeConfiguration(), caller, items, successUrl, cancelUrl, transform);
  };

  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };
};
