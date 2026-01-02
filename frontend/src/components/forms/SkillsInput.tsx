import { useState, KeyboardEvent, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ALL_SKILLS } from "@/data/mergedSkills";

interface SkillsInputProps {
  skills: string[];
  onSkillsChange: (skills: string[]) => void;
  label?: string;
  placeholder?: string;
  maxSkills?: number;
}

const SkillsInput = ({
  skills,
  onSkillsChange,
  label = "Skills",
  placeholder = "Type a skill and press Enter",
  maxSkills = 10,
}: SkillsInputProps) => {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const [filteredSkills, setFilteredSkills] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on input - show 10 at a time
  useEffect(() => {
    // Filter out already selected skills
    const availableSkills = ALL_SKILLS.filter(skill => !skills.includes(skill));
    
    if (!inputValue.trim()) {
      // If no input, show first 10 available skills
      setFilteredSkills(availableSkills.slice(0, 10));
    } else {
      // Filter by input and limit to 10 results
      const filtered = availableSkills
        .filter(skill =>
          skill.toLowerCase().includes(inputValue.toLowerCase())
        )
        .slice(0, 10);
      setFilteredSkills(filtered);
    }
  }, [inputValue, skills]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      addSkill(inputValue.trim());
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const addSkill = (skill: string) => {
    const normalizedSkill = skill.trim();
    if (
      normalizedSkill &&
      !skills.includes(normalizedSkill) &&
      skills.length < maxSkills
    ) {
      onSkillsChange([...skills, normalizedSkill]);
      setInputValue("");
      // Don't close popover - keep it open for quick adding
      // Only close if max skills reached
      if (skills.length + 1 >= maxSkills) {
        setOpen(false);
      }
      // Focus back on input after adding
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const removeSkill = (skillToRemove: string) => {
    onSkillsChange(skills.filter((skill) => skill !== skillToRemove));
  };

  const handleSelectSuggestion = (selectedSkill: string) => {
    addSkill(selectedSkill);
    // Keep popover open after selection to allow adding more skills
    setTimeout(() => {
      inputRef.current?.focus();
      setOpen(true);
    }, 100);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-2 border border-border rounded-md bg-background">
          {skills.map((skill) => (
            <Badge
              key={skill}
              variant="secondary"
              className="flex items-center gap-1 px-2 py-1"
            >
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(skill)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {skills.length < maxSkills && (
            <Popover open={open} onOpenChange={setOpen} modal={false}>
              <PopoverTrigger asChild>
                <div className="flex-1 min-w-[150px]">
                  <Input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      if (!open) setOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      setOpen(true);
                    }}
                    placeholder={placeholder}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto"
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => {
                  setOpen(false);
                  inputRef.current?.focus();
                }}
                onInteractOutside={(e) => {
                  const target = e.target as HTMLElement;
                  // Prevent closing when interacting with input or popover content
                  if (
                    target.closest('input') ||
                    target.closest('[role="dialog"]') ||
                    target.closest('[cmdk-input-wrapper]') ||
                    target.closest('[cmdk-list]')
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search skills..."
                    value={inputValue}
                    onValueChange={(value) => {
                      setInputValue(value);
                      if (!open) setOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setOpen(false);
                        inputRef.current?.focus();
                      }
                    }}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {inputValue.trim() ? (
                        <div className="py-2">
                          <p className="text-sm text-muted-foreground mb-2">
                            Press Enter to add "{inputValue}"
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addSkill(inputValue)}
                            className="w-full"
                          >
                            Add Custom Skill
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Start typing to search skills...
                        </p>
                      )}
                    </CommandEmpty>
                    <CommandGroup heading="Suggestions (showing 10)">
                      {filteredSkills.map((skill) => (
                        <CommandItem
                          key={skill}
                          value={skill}
                          onSelect={() => handleSelectSuggestion(skill)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              skills.includes(skill) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {skill}
                        </CommandItem>
                      ))}
                      {filteredSkills.length === 0 && inputValue.trim() && (
                        <CommandItem disabled className="text-muted-foreground">
                          No matching skills found
                        </CommandItem>
                      )}
                    </CommandGroup>
                    {inputValue.trim() && !ALL_SKILLS.some(
                      skill =>
                        skill.toLowerCase() === inputValue.toLowerCase()
                    ) && (
                      <CommandGroup>
                        <CommandItem
                          value={inputValue}
                          onSelect={() => addSkill(inputValue)}
                          className="cursor-pointer font-medium"
                        >
                          <ChevronsUpDown className="mr-2 h-4 w-4" />
                          Add "{inputValue}" as custom skill
                        </CommandItem>
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {skills.length}/{maxSkills} skills added
        </p>
      </div>
    </div>
  );
};

export default SkillsInput;

