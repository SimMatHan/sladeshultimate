/**
 * VAPID Key Validator
 * 
 * Dette script hjælper med at validere om din VAPID_PUBLIC_KEY er korrekt formateret.
 * Kør det i browser console eller Node.js for at teste din nøgle.
 */

/**
 * Validerer en VAPID public key
 * @param {string} key - VAPID public key til validering
 * @returns {object} - Resultat med status og eventuelle fejl
 */
function validateVapidKey(key) {
    const result = {
        valid: false,
        errors: [],
        warnings: [],
        info: {}
    }

    // 1. Check if key exists
    if (!key) {
        result.errors.push('❌ Nøgle er tom eller undefined')
        return result
    }

    if (typeof key !== 'string') {
        result.errors.push('❌ Nøgle er ikke en string')
        return result
    }

    result.info.originalLength = key.length

    // 2. Check for whitespace
    const hasWhitespace = /\s/.test(key)
    if (hasWhitespace) {
        result.warnings.push('⚠️  Nøgle indeholder whitespace (mellemrum, newlines, tabs)')
        result.info.whitespaceCount = (key.match(/\s/g) || []).length
    }

    // 3. Sanitize
    const sanitized = key.replace(/\s+/g, '')
    result.info.sanitizedLength = sanitized.length

    if (sanitized.length === 0) {
        result.errors.push('❌ Nøgle er tom efter fjernelse af whitespace')
        return result
    }

    // 4. Check Base64 URL-safe format
    const base64UrlPattern = /^[A-Za-z0-9_-]+$/
    if (!base64UrlPattern.test(sanitized)) {
        result.errors.push('❌ Nøgle indeholder ugyldige tegn (kun A-Z, a-z, 0-9, -, _ er tilladt)')

        // Find invalid characters
        const invalidChars = sanitized.match(/[^A-Za-z0-9_-]/g)
        if (invalidChars) {
            result.info.invalidCharacters = [...new Set(invalidChars)].join(', ')
        }
        return result
    }

    // 5. Check typical length (VAPID keys are usually 87-88 chars)
    if (sanitized.length < 80) {
        result.warnings.push('⚠️  Nøgle er kortere end forventet (typisk 87-88 tegn)')
    } else if (sanitized.length > 90) {
        result.warnings.push('⚠️  Nøgle er længere end forventet (typisk 87-88 tegn)')
    }

    // 6. Try to decode
    try {
        const padding = '='.repeat((4 - (sanitized.length % 4)) % 4)
        const base64 = (sanitized + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/')

        const decoded = atob(base64)
        result.info.decodedLength = decoded.length

        // VAPID keys should decode to 65 bytes (uncompressed P-256 public key)
        if (decoded.length === 65) {
            result.info.keyFormat = '✅ Korrekt P-256 uncompressed public key format'
        } else {
            result.warnings.push(`⚠️  Decoded længde er ${decoded.length} bytes (forventet 65 bytes)`)
        }

        result.valid = true
        result.info.status = '✅ Nøgle er gyldig!'

    } catch (error) {
        result.errors.push(`❌ Kunne ikke decode nøgle: ${error.message}`)
        return result
    }

    return result
}

/**
 * Printer validerings resultat på en pæn måde
 */
function printValidationResult(result) {
    console.log('\n=== VAPID KEY VALIDATION RESULT ===\n')

    if (result.errors.length > 0) {
        console.log('🔴 FEJL:')
        result.errors.forEach(err => console.log('  ' + err))
        console.log('')
    }

    if (result.warnings.length > 0) {
        console.log('🟡 ADVARSLER:')
        result.warnings.forEach(warn => console.log('  ' + warn))
        console.log('')
    }

    if (Object.keys(result.info).length > 0) {
        console.log('ℹ️  INFO:')
        Object.entries(result.info).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`)
        })
        console.log('')
    }

    if (result.valid) {
        console.log('✅ RESULTAT: Nøgle er gyldig og klar til brug!\n')
    } else {
        console.log('❌ RESULTAT: Nøgle er IKKE gyldig. Ret fejlene ovenfor.\n')
    }

    console.log('===================================\n')
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { validateVapidKey, printValidationResult }
}

// Browser usage example
if (typeof window !== 'undefined') {
    window.validateVapidKey = validateVapidKey
    window.printValidationResult = printValidationResult

    console.log('✅ VAPID Validator loaded!')
    console.log('📝 Brug: validateVapidKey("din-nøgle-her")')
    console.log('📝 Eller: printValidationResult(validateVapidKey("din-nøgle-her"))')
}

// CLI usage for Node.js
if (typeof require !== 'undefined' && require.main === module) {
    const keyToTest = process.argv[2]

    if (!keyToTest) {
        console.log('Usage: node validateVapidKey.js <VAPID_PUBLIC_KEY>')
        console.log('Example: node validateVapidKey.js BNcRdreALWjXDPCSPHTlwoZiMw...')
        process.exit(1)
    }

    const result = validateVapidKey(keyToTest)
    printValidationResult(result)

    process.exit(result.valid ? 0 : 1)
}
