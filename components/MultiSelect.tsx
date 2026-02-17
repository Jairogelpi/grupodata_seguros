"use client";

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx'; // Assuming clsx is installed, otherwise use template literals

interface MultiSelectProps {
    label: string;
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
}

export default function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset search when opening/closing
    useEffect(() => {
        if (!isOpen) setSearchTerm('');
    }, [isOpen]);

    const filteredOptions = options.filter(opt =>
        String(opt).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleOption = (option: string) => {
        let newSelected = [...selected];

        if (option === 'Todos') {
            onChange([]);
            setIsOpen(false);
            return;
        }

        if (newSelected.includes(option)) {
            newSelected = newSelected.filter(item => item !== option);
        } else {
            newSelected.push(option);
        }
        onChange(newSelected);
    };

    const isSelected = (option: string) => selected.includes(option);
    const isTodos = selected.length === 0;

    const getDisplayText = () => {
        if (isTodos) return 'Todos';
        if (selected.length === 1) return selected[0];
        if (selected.length <= 2) return selected.join(', ');
        return `${selected.length} seleccionados`;
    };

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between text-left bg-white border border-slate-300 text-slate-700 py-2.5 px-3 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            >
                <span className="truncate">{getDisplayText()}</span>
                <ChevronDown className={clsx("h-4 w-4 text-slate-500 ml-2 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute z-[50] mt-1 w-full min-w-[220px] bg-white shadow-2xl max-h-80 rounded-xl py-2 text-base ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm flex flex-col border border-slate-100 left-0">
                    {/* Search Input */}
                    <div className="px-3 pb-2 pt-1 border-b border-slate-100">
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            value={searchTerm}
                            autoFocus
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="overflow-auto mt-1 max-h-60">
                        <div
                            className={clsx(
                                "cursor-pointer select-none relative py-2.5 pl-3 pr-9 hover:bg-slate-50",
                                isTodos ? "font-semibold text-primary" : "text-slate-900"
                            )}
                            onClick={() => toggleOption('Todos')}
                        >
                            <span className="block truncate">Todos</span>
                            {isTodos && (
                                <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-primary">
                                    <Check className="h-4 w-4" />
                                </span>
                            )}
                        </div>

                        {filteredOptions.length === 0 ? (
                            <div className="py-4 text-center text-slate-400 italic">No hay resultados</div>
                        ) : (
                            filteredOptions.map((option) => {
                                const selectedItem = isSelected(option);
                                return (
                                    <div
                                        key={option}
                                        className={clsx(
                                            "cursor-pointer select-none relative py-2.5 pl-3 pr-9 hover:bg-slate-50",
                                            selectedItem ? "font-semibold text-primary" : "text-slate-900"
                                        )}
                                        onClick={() => toggleOption(option)}
                                    >
                                        <span className="block truncate">{option}</span>
                                        {selectedItem && (
                                            <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-primary">
                                                <Check className="h-4 w-4" />
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
