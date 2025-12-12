export interface SharedPrompt {
    id: string;
    name: string;
    text: string;
    timestamp: number;
}

const API_BASE = '/api/prompts/';

export const fetchSharedPrompts = async (): Promise<SharedPrompt[]> => {
    try {
        const response = await fetch(API_BASE);
        if (!response.ok) throw new Error('Failed to fetch prompts');
        return await response.json();
    } catch (error) {
        console.error("Error fetching shared prompts:", error);
        return [];
    }
};

export const publishSharedPrompt = async (name: string, text: string): Promise<SharedPrompt> => {
    const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, text })
    });

    if (!response.ok) {
        throw new Error('Failed to publish prompt');
    }
    return await response.json();
};

export const deleteSharedPrompt = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete prompt');
};
