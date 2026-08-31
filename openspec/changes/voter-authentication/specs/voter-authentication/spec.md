## Purpose

Provides a secure and anonymous authentication flow for voters using SMS-delivered codes and admin-generated codes.

## ADDED Requirements

### Requirement: Voter Code Generation
The system SHALL generate a 6-character hexadecimal code for a valid phone number, send it via SMS, and store a hash of the phone number mapped to the code with a 30-minute expiration.

#### Scenario: Code generated for new voter
- **WHEN** a voter requests a code for a phone number that has not voted
- **THEN** the system generates a code, stores it in the cache, and sends an SMS containing the code.

#### Scenario: Code rejected for already-voted phone number
- **WHEN** a voter requests a code for a phone number that already has a ballot submitted
- **THEN** the system returns a 400 Bad Request and does not send an SMS.

### Requirement: Admin Code Generation
The system SHALL allow authenticated administrative users to generate a 6-character hexadecimal code mapped to a random UUID hash, stored with a 7-day expiration.

#### Scenario: Admin generates manual code
- **WHEN** an admin requests a code for a voter
- **THEN** the system generates a code, stores it in the cache mapped to a UUID, and returns the code to the admin.

### Requirement: Voter Code Verification
The system SHALL authenticate a user by verifying a submitted code against the cache.

#### Scenario: Valid code submitted
- **WHEN** a voter submits a valid, unexpired code
- **THEN** the system sets the session as verified with the associated ID hash.

#### Scenario: Invalid code submitted
- **WHEN** a voter submits an invalid or expired code
- **THEN** the system returns a 404 Not Found error.
