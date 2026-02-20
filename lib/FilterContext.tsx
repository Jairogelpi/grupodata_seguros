"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

interface Filters {
    comercial: string[];
    ente: string[];
    anio: string[];
    mes: string[];
    estado: string[];
    ramo: string[];
    producto: string[];
    startYear: string[];
    startMonth: string[];
    endYear: string[];
    endMonth: string[];
    compania: string[];
}

interface FilterContextType {
    filters: Filters;
    setFilters: React.Dispatch<React.SetStateAction<Filters>>;
    updateFilter: (key: keyof Filters, values: string[]) => void;
    clearFilters: () => void;
}

const defaultFilters: Filters = {
    comercial: [],
    ente: [],
    anio: [],
    mes: [],
    estado: [],
    ramo: [],
    producto: [],
    startYear: [],
    startMonth: [],
    endYear: [],
    endMonth: [],
    compania: []
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
    const [filters, setFilters] = useState<Filters>(defaultFilters);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initial load from localStorage
    useEffect(() => {
        const savedFilters = localStorage.getItem('global_filters');
        if (savedFilters) {
            try {
                setFilters(JSON.parse(savedFilters));
            } catch (e) {
                console.error("Failed to parse saved filters", e);
            }
        }
        setIsInitialized(true);
    }, []);

    // Save to localStorage whenever filters change
    useEffect(() => {
        if (isInitialized) {
            localStorage.setItem('global_filters', JSON.stringify(filters));
        }
    }, [filters, isInitialized]);

    const updateFilter = (key: keyof Filters, values: string[]) => {
        setFilters(prev => ({ ...prev, [key]: values }));
    };

    const clearFilters = () => {
        setFilters(defaultFilters);
    };

    return (
        <FilterContext.Provider value={{ filters, setFilters, updateFilter, clearFilters }}>
            {children}
        </FilterContext.Provider>
    );
}

export function useFilters() {
    const context = useContext(FilterContext);
    if (context === undefined) {
        throw new Error('useFilters must be used within a FilterProvider');
    }
    return context;
}
