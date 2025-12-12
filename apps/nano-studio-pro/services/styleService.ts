export interface SharedStyle {
    id: string;
    name: string;
    prompt: string;
    imageUrl: string;
    timestamp: number;
}

const API_BASE = '/api/styles';

export const fetchSharedStyles = async (): Promise<SharedStyle[]> => {
    try {
        const response = await fetch(API_BASE);
        if (!response.ok) throw new Error('Failed to fetch styles');
        return await response.json();
    } catch (error) {
        console.error("Error fetching shared styles:", error);
        return [];
    }
};

export const publishSharedStyle = async (name: string, prompt: string, imageData: string): Promise<SharedStyle> => {
    const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, prompt, imageData })
    });

    if (!response.ok) {
        throw new Error('Failed to publish style');
    }
    return await response.json();
};

export const deleteSharedStyle = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete style');
};
