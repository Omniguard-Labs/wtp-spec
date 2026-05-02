package wtp

import (
	"strings"
	"time"
)

const (
	StandardName              = "Wallet Transaction Provenance Standard"
	ShortIdentifier           = "WTP"
	VersionLabel               = "WTP-v1"
	WireNamespace             = "wtp"
	EnvelopeSchema             = "wtp"
	TrustMetadataSchema        = "wtp-trust"
	QRTextPrefix               = "wtp1:"
	QRFramePrefix              = "wtp1/"
	WellKnownSuffix            = "wtp"
	MetadataCBORPath           = "/.well-known/wtp/metadata.cbor"
	MetadataJSONPath           = "/.well-known/wtp/metadata.json"
	ChainFamilyEVM             = "evm"
	ProfileEVMTxV1             = "evm-tx-v1"
	ProfileEVMSafeV1           = "evm-safe-v1"
	ProfileSolanaTxV1          = "solana-tx-v1"
	DefaultVendorRootDays      = 365
	DefaultQRSigningCertDays   = 180
	DefaultTrustMetadataDays   = 180
	AlgorithmEd25519          = "Ed25519"
	RecordTypeVendorRoot      = "vendor_root"
	CertificateTypeQRSigning   = "qr_signing"
	RevocationTypeSigningKey  = "signing_key"
	RevocationTypeVendorRoot  = "vendor_root"
	AuthModeNone              = "none"
	AuthModeRootSignature     = "root_sig"
)

type EncodedBytes struct {
	Encoding string `json:"encoding"`
	Value    string `json:"value"`
}

type VendorRootRecord struct {
	Version         int          `json:"version"`
	RecordType     string       `json:"record_type"`
	VendorID       string       `json:"vendor_id"`
	DisplayName    string       `json:"display_name"`
	Algorithm      string       `json:"algorithm"`
	PublicKey      EncodedBytes `json:"public_key"`
	RootFingerprint string      `json:"root_fingerprint"`
	ValidFrom      string       `json:"valid_from"`
	ValidTo        string       `json:"valid_to"`
	Status         string       `json:"status"`
}

type QRSigningCertificate struct {
	Version               int          `json:"version"`
	CertType              string       `json:"cert_type"`
	VendorID              string       `json:"vendor_id"`
	KeyID                 string       `json:"key_id"`
	Algorithm             string       `json:"algorithm"`
	PublicKey             EncodedBytes `json:"public_key"`
	IssuerRootFingerprint string       `json:"issuer_root_fingerprint"`
	ValidFrom             string       `json:"valid_from"`
	ValidTo               string       `json:"valid_to"`
	Status                string       `json:"status"`
	IssuerSignature       EncodedBytes `json:"issuer_signature"`
}

type RevocationRecord struct {
	Type            string `json:"type"`
	KeyID           string `json:"key_id,omitempty"`
	RootFingerprint string `json:"root_fingerprint,omitempty"`
	RevokedAt       string `json:"revoked_at,omitempty"`
	Reason          string `json:"reason,omitempty"`
}

type MirrorRecord struct {
	Role      string `json:"role"`
	URL       string `json:"url"`
	MediaType string `json:"media_type"`
}

type MetadataAuth struct {
	AuthMode        string       `json:"auth_mode"`
	RootFingerprint string      `json:"root_fingerprint,omitempty"`
	SigningKeyID    string      `json:"signing_key_id,omitempty"`
	Algorithm       string      `json:"algorithm,omitempty"`
	Signature       EncodedBytes `json:"signature,omitempty"`
}

type TrustMetadata struct {
	Schema          string                 `json:"schema"`
	Version         int                    `json:"version"`
	VendorID        string                 `json:"vendor_id"`
	DisplayName     string                 `json:"display_name"`
	IssuedAt        string                 `json:"issued_at"`
	ExpiresAt       string                 `json:"expires_at"`
	Roots           []VendorRootRecord     `json:"roots"`
	QRSigningCerts  []QRSigningCertificate `json:"qr_signing_certs"`
	Revocations     []RevocationRecord     `json:"revocations"`
	Mirrors          []MirrorRecord         `json:"mirrors"`
	Auth            MetadataAuth           `json:"auth"`
}

type WellKnownURLs struct {
	Suffix          string
	MetadataCBORURL string
	MetadataJSONURL string
}

func BuildWellKnownWtpURLs(origin string) WellKnownURLs {
	base := strings.TrimRight(origin, "/")
	return WellKnownURLs{
		Suffix:          WellKnownSuffix,
		MetadataCBORURL: base + MetadataCBORPath,
		MetadataJSONURL: base + MetadataJSONPath,
	}
}

func AddDaysToISO(iso string, days int) (string, error) {
	t, err := time.Parse(time.RFC3339Nano, iso)
	if err != nil {
		return "", err
	}
	return FormatISO(t.AddDate(0, 0, days)), nil
}

func FormatISO(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

func IsISODateWithinRange(nowValue, validFrom, validTo string) bool {
	now, err := time.Parse(time.RFC3339Nano, nowValue)
	if err != nil {
		return false
	}
	if validFrom != "" {
		start, err := time.Parse(time.RFC3339Nano, validFrom)
		if err != nil || now.Before(start) {
			return false
		}
	}
	if validTo != "" {
		end, err := time.Parse(time.RFC3339Nano, validTo)
		if err != nil || now.After(end) {
			return false
		}
	}
	return true
}
