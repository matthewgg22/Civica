import Foundation

// Session A — bilingual description copy for the CA LPIE student
// exemption. Hand-mirrored from
// `packages/snap-compliance-copy/data/exemption-copy.json` (id:
// "lpie_half_time_degree"). The TS package is the source of truth;
// when the SNAPComplianceCopyRegistry Swift codegen pipeline grows
// support for the new ExemptionCopy entries, these constants will be
// auto-generated.
//
// TODO: replace with actual CA CDSS ACL number for LPIE expansion (Matthew to provide)

enum LPIEExemptionCopy {
    static let englishDescription: String = """
        Enrolled at least half-time in a degree or certificate program at a CA Community College, CSU, or UC. \
        You meet the student exemption automatically.
        """

    static let spanishDescription: String = """
        Inscrito al menos medio tiempo en un programa de grado o certificado en CCC, CSU o UC. \
        Cumple la exención estudiantil automáticamente.
        """
}
