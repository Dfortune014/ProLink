import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Plus, Trash2, Edit2, ExternalLink, Image as ImageIcon } from "lucide-react";
import { profilesApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import ImageUpload from "@/components/forms/ImageUpload";

interface Project {
  id?: string;
  title: string;
  description: string;
  link: string;
  image_url?: string;
  image_key?: string;
  tech_stack?: string[];
  order?: number;
}

const ProjectsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [techStackInput, setTechStackInput] = useState<string>("");
  const [formData, setFormData] = useState<Project>({
    title: "",
    description: "",
    link: "",
    image_url: "",
    image_key: "",
    tech_stack: [],
  });
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const userData = await profilesApi.getCurrentUser();
      
      if (userData.username) {
        try {
          const profile = await profilesApi.getByUsername(userData.username);
          setProjects(profile.projects || []);
        } catch (error) {
          console.error("Failed to load profile:", error);
          setProjects([]);
        }
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
      toast({
        title: "Error",
        description: "Failed to load projects.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditingId(null);
    setTechStackInput("");
    setFormData({
      title: "",
      description: "",
      link: "",
      image_url: "",
      image_key: "",
      tech_stack: [],
    });
  };

  const handleEdit = (project: Project) => {
    setEditingId(project.id || null);
    setTechStackInput(project.tech_stack?.join(", ") || "");
    setFormData({
      id: project.id,
      title: project.title,
      description: project.description,
      link: project.link,
      image_url: project.image_url || "",
      image_key: project.image_key || "",
      tech_stack: project.tech_stack || [],
    });
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project?")) {
      return;
    }

    try {
      const updatedProjects = projects.filter((p) => p.id !== projectId);
      await saveProjects(updatedProjects);
      toast({
        title: "Project deleted",
        description: "The project has been removed.",
      });
    } catch (error: unknown) {
      console.error("Failed to delete project:", error);
      toast({
        title: "Error",
        description: "Failed to delete project.",
        variant: "destructive",
      });
    }
  };

  const handleImageUploaded = (data: { url: string; key: string }) => {
    setFormData((prev) => ({
      ...prev,
      image_url: data.url,
      image_key: data.key,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({
        title: "Validation error",
        description: "Project title is required.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.link.trim()) {
      toast({
        title: "Validation error",
        description: "Project link is required.",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format
    let formattedLink = formData.link.trim();
    if (!formattedLink.startsWith("http://") && !formattedLink.startsWith("https://")) {
      formattedLink = `https://${formattedLink}`;
    }

    try {
      setSaving(true);
      const userData = await profilesApi.getCurrentUser();

      // Parse tech stack from input string
      const techStack = techStackInput
        .split(",")
        .map((tech) => tech.trim())
        .filter((tech) => tech.length > 0);

      const projectData: Project = {
        ...formData,
        link: formattedLink,
        tech_stack: techStack,
        id: editingId || `project-${Date.now()}`,
        order: editingId ? projects.find((p) => p.id === editingId)?.order : projects.length,
      };

      let updatedProjects: Project[];
      if (editingId) {
        updatedProjects = projects.map((p) =>
          p.id === editingId ? projectData : p
        );
      } else {
        updatedProjects = [...projects, projectData];
      }

      await saveProjects(updatedProjects);

      toast({
        title: editingId ? "Project updated" : "Project added",
        description: `Your project has been ${editingId ? "updated" : "added"} successfully.`,
      });

      setEditingId(null);
      setTechStackInput("");
      setFormData({
        title: "",
        description: "",
        link: "",
        image_url: "",
        image_key: "",
        tech_stack: [],
      });

      // Notify Dashboard to refresh
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (error: unknown) {
      console.error("Failed to save project:", error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to save project.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveProjects = async (projectsToSave: Project[]) => {
    const userData = await profilesApi.getCurrentUser();
    
    // Lambda now preserves existing fields, so we only need to send projects
    await profilesApi.createOrUpdate({
      username: userData.username,
      projects: projectsToSave,
    });
    
    // Wait a bit before reloading to ensure Lambda has processed
    await new Promise(resolve => setTimeout(resolve, 300));
    await loadProjects();
  };

  const formatUrl = (url: string): string => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `https://${url}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Projects / Accomplishment</h1>
        <p className="text-muted-foreground mt-2">
          Showcase your work and accomplishments with project cards featuring images, descriptions, and links.
        </p>
      </div>

      {/* Existing Projects */}
      {projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="overflow-hidden">
              {project.image_url && !imageErrors[project.id || project.title] ? (
                <div className="aspect-video bg-muted overflow-hidden">
                  <img
                    src={project.image_url}
                    alt={project.title}
                    className="w-full h-full object-cover"
                    onError={() => {
                      console.error("Failed to load project image:", project.image_url);
                      setImageErrors(prev => ({ ...prev, [project.id || project.title]: true }));
                    }}
                  />
                </div>
              ) : project.image_url && imageErrors[project.id || project.title] ? (
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              ) : null}
              <CardHeader>
                <CardTitle className="text-lg">{project.title}</CardTitle>
                {project.description && (
                  <CardDescription className="line-clamp-2">
                    {project.description}
                  </CardDescription>
                )}
                {project.tech_stack && project.tech_stack.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {project.tech_stack.map((tech, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={formatUrl(project.link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Project
                  </a>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(project)}
                      className="h-8 w-8"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(project.id!)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Project" : "Add New Project"}</CardTitle>
          <CardDescription>
            {editingId
              ? "Update your project information."
              : "Create a new project card to showcase your work."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Image */}
            <div className="space-y-2">
              <ImageUpload
                currentImageUrl={formData.image_url}
                onImageUploaded={handleImageUploaded}
                getInitials={() => formData.title.slice(0, 2).toUpperCase() || "PR"}
                uploadType="project_image"
                label="Project Image"
                variant="rectangle"
              />
            </div>

            {/* Project Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="My Awesome Project"
                required
              />
            </div>

            {/* Project Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe your project..."
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Project Link */}
            <div className="space-y-2">
              <Label htmlFor="link">Project Link *</Label>
              <Input
                id="link"
                type="url"
                value={formData.link}
                onChange={(e) =>
                  setFormData({ ...formData, link: e.target.value })
                }
                placeholder="https://example.com/project"
                required
              />
              <p className="text-xs text-muted-foreground">
                The URL where visitors can view your project.
              </p>
            </div>

            {/* Tech Stack */}
            <div className="space-y-2">
              <Label htmlFor="tech_stack">Tech Stack</Label>
              <Input
                id="tech_stack"
                value={techStackInput}
                onChange={(e) => {
                  setTechStackInput(e.target.value);
                  // Parse and update formData for preview
                  const value = e.target.value;
                  const techStack = value
                    .split(",")
                    .map((tech) => tech.trim())
                    .filter((tech) => tech.length > 0);
                  setFormData({ ...formData, tech_stack: techStack });
                }}
                placeholder="React, TypeScript, Node.js (comma-separated)"
              />
              <p className="text-xs text-muted-foreground">
                Enter technologies used in this project, separated by commas.
              </p>
              {formData.tech_stack && formData.tech_stack.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {formData.tech_stack.map((tech, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {editingId ? "Update Project" : "Add Project"}
                  </>
                )}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddNew}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectsPage;

