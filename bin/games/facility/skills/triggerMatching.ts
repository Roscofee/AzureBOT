function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchesTriggerToken(content: string, token: string): boolean {
    const normalizedToken = token.trim().toLowerCase();
    if (!normalizedToken) return false;

    const escaped = escapeRegex(normalizedToken).replace(/\s+/g, "\\s+");
    const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "u");
    return pattern.test(content.toLowerCase());
}

export function matchesAnyTriggerToken(content: string, tokens: readonly string[]): boolean {
    return tokens.some((token) => matchesTriggerToken(content, token));
}
