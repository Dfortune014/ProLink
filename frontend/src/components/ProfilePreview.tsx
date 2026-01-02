import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Phone, 
  Mail,
  Link2, 
  Award, 
  FolderKanban, 
  FileText,
  Plus,
  Settings,
  ExternalLink
} from "lucide-react";
import { SOCIAL_PLATFORMS, SocialPlatformKey } from "@/components/icons/SocialIcons";

interface Project {
  id?: string;
  title: string;
  description?: string;
  link: string;
  image_url?: string;
  image_key?: string;
  tech_stack?: string[];
  order?: number;
}

interface ProfilePreviewProps {
  profile?: {
    full_name?: string;
    username?: string;
    title?: string;
    bio?: string;
    profile_image_url?: string;
    avatar_url?: string;
    social_links?: Record<string, string>;
    skills?: string[];
    email?: string;
    phone?: string;
    show_email?: boolean;
    show_phone?: boolean;
    projects?: Project[];
    resume_url?: string;
    resumeUrl?: string;
    resume_key?: string;
  };
  onAddSection?: (section: string) => void;
}

const ProfilePreview = ({ profile, onAddSection }: ProfilePreviewProps) => {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  
  // Use default purple accent color
  const accentColor = "#7C3AED";
  
  // Helper function to get contrast color (white or black) based on luminance
  const getContrastColor = (hexColor: string): string => {
    // Remove # if present
    const color = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return black for light colors, white for dark colors
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  };
  
  const textColor = getContrastColor(accentColor);
  
  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return "U";
  };

  const hasBio = !!profile?.bio;
  // For owner's preview, show contact info if it exists (visibility flags are for public view)
  const hasContactInfo = !!(profile?.email || profile?.phone);
  const hasLinks = !!(profile?.social_links && Object.keys(profile.social_links).length > 0);
  const hasSkills = !!(profile?.skills && profile.skills.length > 0);
  const hasProjects = !!(profile?.projects && profile.projects.length > 0);
  
  // Use resume URL from profile (should be presigned URL from backend)
  // Backend Lambda generates presigned URLs automatically from resume_key
  const resumeUrl = profile?.resume_url || profile?.resumeUrl || null;
  const hasResume = !!(resumeUrl || profile?.resume_key);
  
  // Comprehensive debug logging
  useEffect(() => {
    if (profile) {
      console.log("🔍 ProfilePreview: Full Profile Debug", {
        profileId: profile.id || profile.user_id || 'unknown',
        fullProfile: profile,
        resumeData: {
          resume_url: profile.resume_url,
          resumeUrl: profile.resumeUrl,
          resume_key: profile.resume_key,
          show_resume: profile.show_resume,
          finalResumeUrl: resumeUrl,
          hasResume: hasResume,
          resumeUrlType: resumeUrl ? typeof resumeUrl : 'null',
          resumeUrlLength: resumeUrl ? resumeUrl.length : 0,
          isPresignedUrl: resumeUrl ? resumeUrl.includes('X-Amz-Signature') : false,
          isS3Url: resumeUrl ? resumeUrl.includes('s3.amazonaws.com') : false,
        },
        profileKeys: Object.keys(profile),
      });
      
      // Check if resume URL is valid
      if (resumeUrl) {
        console.log("✅ Resume URL found:", {
          url: resumeUrl,
          isValid: resumeUrl.startsWith('http'),
          isPresigned: resumeUrl.includes('X-Amz-Signature'),
          preview: resumeUrl.substring(0, 100) + '...',
        });
      } else if (profile.resume_key) {
        console.warn("⚠️ Resume key exists but no resume URL:", {
          resume_key: profile.resume_key,
          message: "Backend should generate presigned URL from resume_key",
        });
      } else {
        console.log("ℹ️ No resume data found in profile");
      }
    }
  }, [profile, resumeUrl, hasResume]);

  return (
    <div className="h-fit w-full">
      {/* Phone Frame Container */}
      <div className="w-full bg-zinc-900 rounded-[24px] sm:rounded-[32px] p-1.5 sm:p-2 shadow-2xl mx-auto">
        {/* Phone Screen */}
        <div className="bg-zinc-950 rounded-[16px] sm:rounded-[24px] overflow-hidden">
          {/* Phone Top Bar */}
          <div className="bg-zinc-900 px-4 py-2 flex items-center justify-between border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-zinc-400" />
              <span className="text-xs text-zinc-400 font-mono">
                prolynk.ee/{profile?.username || "username"}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-zinc-300">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Profile Content */}
          <div className="bg-zinc-950 min-h-[900px]">
            {/* Profile Picture Section */}
            <div className="w-full relative">
              {(profile?.avatar_url || profile?.profile_image_url) && !imageErrors['profile'] ? (
                <div className="w-full aspect-[4/3] bg-zinc-900 overflow-hidden relative">
                  <img 
                    src={profile?.avatar_url || profile?.profile_image_url} 
                    alt={profile?.full_name || "Profile"}
                    className="w-full h-full object-cover object-[center_30%]"
                    onError={() => {
                      console.error("Failed to load profile image:", profile?.avatar_url || profile?.profile_image_url);
                      setImageErrors(prev => ({ ...prev, profile: true }));
                    }}
                  />
                  {/* Gradient overlay at bottom */}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent pointer-events-none" />
                </div>
              ) : (
                <div className="w-full aspect-[4/3] bg-zinc-800 flex items-center justify-center">
                  <div className="text-4xl font-bold text-zinc-600">
                    {getInitials()}
                  </div>
                </div>
              )}
            </div>

            {/* Name and Title Section */}
            <div className="pt-6 pb-4 px-6 flex flex-col items-center">
              <h2 className="text-4xl font-bold text-zinc-100 mb-1">
                {profile?.full_name || "Your Name"}
              </h2>
              {profile?.title && (
                <p className="text-sm text-zinc-400 mb-2">
                  {profile.title}
                </p>
              )}
              {profile?.username && (
                <p className="text-sm text-zinc-500">
                  @{profile.username}
                </p>
              )}
              
              {/* Social Links Icons and Phone */}
              {(hasLinks || profile?.phone) && (
                <div className="flex items-center gap-3 mt-3">
                  {Object.entries(profile.social_links || {}).map(([key, url]) => {
                    const platform = SOCIAL_PLATFORMS.find(p => p.key === key);
                    if (!platform || !url) return null;
                    
                    const Icon = platform.icon;
                    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
                    
                    return (
                      <a
                        key={key}
                        href={formattedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-white transition-all"
                        style={{
                          border: `2px solid transparent`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = accentColor;
                          e.currentTarget.style.backgroundColor = accentColor;
                          const icon = e.currentTarget.querySelector('svg');
                          if (icon) icon.style.color = textColor;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'transparent';
                          e.currentTarget.style.backgroundColor = 'white';
                          const icon = e.currentTarget.querySelector('svg');
                          // Reset to default - the icon component has its own brand color
                          if (icon) {
                            icon.style.color = '';
                            icon.style.fill = '';
                          }
                        }}
                        title={platform.label}
                      >
                        <Icon className="h-6 w-6" />
                      </a>
                    );
                  })}
                  {profile?.phone && (
                    <a
                      href={`tel:${profile.phone}`}
                      className="flex items-center justify-center w-10 h-10 rounded-full bg-white hover:opacity-80 transition-all"
                      style={{
                        border: `2px solid transparent`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = accentColor;
                        e.currentTarget.style.backgroundColor = accentColor;
                        e.currentTarget.querySelector('svg')!.style.color = textColor;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.backgroundColor = 'white';
                        const svg = e.currentTarget.querySelector('svg');
                        if (svg) svg.style.color = '';
                      }}
                      title="Phone"
                    >
                      <Phone className="h-6 w-6 text-zinc-900" />
                    </a>
                  )}
                </div>
              )}
              
              {/* Email Button */}
              {profile?.email && (
                <a
                  href={`mailto:${profile.email}`}
                  className="mt-4 px-6 py-2.5 rounded-2xl transition-colors flex items-center justify-center gap-2 text-sm font-medium w-full hover:opacity-90"
                  style={{
                    backgroundColor: accentColor,
                    color: textColor,
                  }}
                >
                  <Mail className="h-4 w-4" />
                  <span>Email me </span>
                </a>
              )}
            </div>

            {/* Content Section */}
            <div className="px-6 pb-6 space-y-3">
              {/* Bio Section */}
              {hasBio ? (
                <div className="p-4 mb-3 bg-zinc-900 rounded-lg border border-zinc-800">
                  <p className="text-sm text-zinc-200 leading-relaxed text-center">
                    {profile.bio}
                  </p>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full mb-3 h-auto py-3 border-dashed border-zinc-700 hover:border-zinc-600 hover:bg-zinc-900 text-zinc-400"
                  onClick={() => onAddSection?.("bio")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="text-sm">Add Bio</span>
                </Button>
              )}

              {/* Contact Info Section - Removed (phone is now with social icons) */}
              {!hasContactInfo && !hasBio && !hasLinks && !hasSkills && (
                <Button
                  variant="outline"
                  className="w-full mb-3 h-auto py-3 border-dashed border-zinc-700 hover:border-zinc-600 hover:bg-zinc-900 text-zinc-400"
                  onClick={() => onAddSection?.("contact")}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  <span className="text-sm">Add Contact Info</span>
                </Button>
              )}

              {/* Projects Section */}
              {hasProjects ? (
                <div className="p-4 mb-3 bg-zinc-900 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2 mb-3">
                    <FolderKanban className="h-4 w-4" style={{ color: accentColor }} />
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                      Projects / Accomplishment
                    </span>
                  </div>
                  <div className="space-y-3">
                    {profile.projects?.map((project) => (
                      <a
                        key={project.id}
                        href={project.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group"
                      >
                        <div 
                          className="bg-zinc-800 rounded-lg overflow-hidden border transition-colors"
                          style={{
                            borderColor: 'rgb(63 63 70)', // zinc-700
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = accentColor;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'rgb(63 63 70)';
                          }}
                        >
                          {project.image_url && !imageErrors[`project-${project.id || project.title}`] ? (
                            <div className="aspect-video bg-zinc-900 overflow-hidden">
                              <img
                                src={project.image_url}
                                alt={project.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={() => {
                                  console.error("Failed to load project image:", project.image_url);
                                  setImageErrors(prev => ({ ...prev, [`project-${project.id || project.title}`]: true }));
                                }}
                              />
                            </div>
                          ) : project.image_url && imageErrors[`project-${project.id || project.title}`] ? (
                            <div className="aspect-video bg-zinc-900 flex items-center justify-center">
                              <FolderKanban className="h-8 w-8 text-zinc-600" />
                            </div>
                          ) : null}
                          <div className="p-3">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-white transition-colors">
                                {project.title}
                              </h4>
                              <ExternalLink className="h-3 w-3 text-zinc-400 flex-shrink-0 mt-0.5" />
                            </div>
                            {project.description && (
                              <p className="text-xs text-zinc-400 line-clamp-2 mb-2">
                                {project.description}
                              </p>
                            )}
                            {project.tech_stack && project.tech_stack.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {project.tech_stack.map((tech, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700"
                                  >
                                    {tech}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full mb-3 h-auto py-3 border-dashed border-zinc-700 hover:border-zinc-600 hover:bg-zinc-900 text-zinc-400"
                  onClick={() => onAddSection?.("projects")}
                >
                  <FolderKanban className="h-4 w-4 mr-2" />
                  <span className="text-sm">Add Projects / Accomplishment</span>
                </Button>
              )}

              {/* Skills Section */}
              {hasSkills ? (
                <div className="p-4 mb-3 bg-zinc-900 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="h-4 w-4" style={{ color: accentColor }} />
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                      Skills
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills?.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 text-xs rounded-lg font-medium border-2"
                        style={{
                          borderColor: accentColor,
                          color: accentColor,
                          backgroundColor: 'transparent',
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full mb-3 h-auto py-3 border-dashed border-zinc-700 hover:border-zinc-600 hover:bg-zinc-900 text-zinc-400"
                  onClick={() => onAddSection?.("skills")}
                >
                  <Award className="h-4 w-4 mr-2" />
                  <span className="text-sm">Add Skills</span>
                </Button>
              )}

              {/* Resume Section */}
              {(() => {
                console.log("🎨 ProfilePreview: Rendering resume section", {
                  hasResume,
                  resumeUrl,
                  resume_key: profile?.resume_key,
                  show_resume: profile?.show_resume,
                });
                return null;
              })()}
              {hasResume ? (
                <div className="p-4 mb-3 bg-zinc-900 rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4" style={{ color: accentColor }} />
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                      Resume
                    </span>
                  </div>
                  {/* PDF Preview - shows top portion of resume */}
                  <a
                    href={resumeUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                    onClick={(e) => {
                      console.log("🖱️ Resume clicked:", {
                        resumeUrl,
                        hasResume,
                        resume_key: profile?.resume_key,
                      });
                      if (!resumeUrl) {
                        console.error("❌ Resume URL is missing, preventing navigation");
                        e.preventDefault();
                      } else {
                        console.log("✅ Opening resume URL:", resumeUrl.substring(0, 100));
                      }
                    }}
                  >
                    <div 
                      className="relative w-full h-48 bg-white rounded-lg overflow-hidden border-2 transition-colors mb-3"
                      style={{
                        borderColor: 'rgb(63 63 70)', // zinc-700
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = accentColor;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgb(63 63 70)';
                      }}
                    >
                      {resumeUrl ? (
                        <>
                          <iframe
                            src={`${resumeUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit&page=1`}
                            className="w-full h-full"
                            title="Resume Preview"
                            style={{ 
                              border: 'none',
                              display: 'block'
                            }}
                            onLoad={() => {
                              console.log("✅ PDF iframe loaded successfully:", resumeUrl?.substring(0, 100));
                            }}
                            onError={(e) => {
                              console.error("❌ Failed to load PDF preview:", {
                                resumeUrl,
                                error: e,
                                iframeSrc: resumeUrl ? `${resumeUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit&page=1` : 'none',
                              });
                            }}
                          />
                          {/* Gradient overlay at bottom to indicate more content - only at bottom */}
                          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent via-transparent to-zinc-900/60 pointer-events-none z-10" />
                          {/* Subtle hover overlay that doesn't block the iframe */}
                          <div className="absolute inset-0 bg-transparent group-hover:bg-black/5 transition-colors pointer-events-none z-20" />
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                          <FileText className="h-12 w-12 text-zinc-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors">
                      <span>Click to view full resume</span>
                      <ExternalLink className="h-3 w-3" />
                    </div>
                  </a>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full mb-3 h-auto py-3 border-dashed border-zinc-700 hover:border-zinc-600 hover:bg-zinc-900 text-zinc-400"
                  onClick={() => onAddSection?.("resume")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  <span className="text-sm">Add Resume</span>
                </Button>
              )}

              {/* Footer Links */}
              <div className="pt-4 border-t border-zinc-800 flex items-center justify-center gap-4 text-xs text-zinc-500">
                <button className="hover:text-zinc-400">Report</button>
                <button className="hover:text-zinc-400">Privacy</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePreview;

