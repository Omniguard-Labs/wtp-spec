package wtp

import "testing"

func TestBuildWellKnownWtpURLs(t *testing.T) {
	urls := BuildWellKnownWtpURLs("https://wallet.example/")

	if urls.Suffix != WellKnownSuffix {
		t.Fatalf("suffix = %q", urls.Suffix)
	}
	if urls.MetadataCBORURL != "https://wallet.example/.well-known/wtp/metadata.cbor" {
		t.Fatalf("metadata CBOR URL = %q", urls.MetadataCBORURL)
	}
	if urls.MetadataJSONURL != "https://wallet.example/.well-known/wtp/metadata.json" {
		t.Fatalf("metadata JSON URL = %q", urls.MetadataJSONURL)
	}
}

func TestAddDaysToISO(t *testing.T) {
	got, err := AddDaysToISO("2026-01-01T00:00:00.000Z", DefaultQRSigningCertDays)
	if err != nil {
		t.Fatal(err)
	}
	if got != "2026-06-30T00:00:00.000Z" {
		t.Fatalf("valid_to = %q", got)
	}
}

func TestIsISODateWithinRange(t *testing.T) {
	if !IsISODateWithinRange(
		"2026-04-30T00:00:00.000Z",
		"2026-04-01T00:00:00.000Z",
		"2026-10-30T00:00:00.000Z",
	) {
		t.Fatal("expected date to be in range")
	}
	if IsISODateWithinRange(
		"2026-11-01T00:00:00.000Z",
		"2026-04-01T00:00:00.000Z",
		"2026-10-30T00:00:00.000Z",
	) {
		t.Fatal("expected date to be out of range")
	}
}
