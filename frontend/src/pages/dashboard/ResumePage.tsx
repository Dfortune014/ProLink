import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, FileText, Download, X } from "lucide-react";
import { profilesApi, uploadApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

const ResumePage = () => {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeKey, setResumeKey] = useState<string | null>(null);
  const [showResume, setShowResume] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadResume();
  }, []);

  const loadResume = async () => {
    try {
      setLoading(true);
      const userData = await profilesApi.getCurrentUser();
      
      if (userData.username) {
        try {
          const profile = await profilesApi.getByUsername(userData.username);
          // Check for resume URL in profile
          const loadedResumeUrl = profile.resume_url || profile.resumeUrl || null;
          const loadedResumeKey = profile.resume_key || profile.resumeKey || null;
          
          if (loadedResumeUrl) {
            setResumeUrl(loadedResumeUrl);
            setResumeKey(loadedResumeKey);
            setShowResume(profile.show_resume ?? true);
          } else if (loadedResumeKey) {
            // Fetch presigned URL from backend if URL is missing but key exists
            try {
              const { uploadApi } = await import('@/services/api');
              const presignedUrl = await uploadApi.getPresignedUrl(loadedResumeKey);
              setResumeUrl(presignedUrl);
              setResumeKey(loadedResumeKey);
              setShowResume(profile.show_resume ?? true);
              
              // Save the presigned URL to the profile
              await profilesApi.createOrUpdate({
                username: userData.username,
                resume_url: presignedUrl,
                resume_key: loadedResumeKey,
              });
            } catch (error) {
              console.error("ResumePage: Failed to fetch presigned URL for resume:", error);
            }
          } else {
            setShowResume(profile.show_resume ?? false);
          }
        } catch (error) {
          console.error("Failed to load profile:", error);
        }
      }
    } catch (error) {
      console.error("Failed to load resume:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type (PDF only)
    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a PDF smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    // Upload file
    setUploading(true);
    try {
      // Get presigned URL
      const response = await uploadApi.getUploadUrl(
        file.name,
        file.type,
        "resume"
      );

      const uploadUrl = response.upload_url || response.uploadUrl;
      let publicUrl = response.url;
      
      // The response.url should already be a presigned URL from the backend
      // If it's missing, we'll need to fetch it separately
      if (!publicUrl && response.key) {
        // Fetch presigned URL from backend
        try {
          const { uploadApi } = await import('@/services/api');
          publicUrl = await uploadApi.getPresignedUrl(response.key);
        } catch (error) {
          console.error("ResumePage: Failed to fetch presigned URL:", error);
          throw new Error("Failed to get presigned URL for resume");
        }
      }

      if (!uploadUrl) {
        throw new Error("No upload URL received from server");
      }
      
      if (!publicUrl) {
        throw new Error("Failed to determine public URL for resume");
      }

      // Upload to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
        credentials: "omit",
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload resume: ${uploadResponse.status}`);
      }

      // Ensure we have a presigned URL - should already be set above
      if (!publicUrl) {
        throw new Error("Failed to determine presigned URL for resume");
      }
      const finalPublicUrl = publicUrl;
      
      // Save resume URL to profile
      const userData = await profilesApi.getCurrentUser();
      
      try {
        await profilesApi.createOrUpdate({
          username: userData.username,
          resume_url: finalPublicUrl,
          resume_key: response.key,
          show_resume: true, // Automatically show resume when uploaded
        });
        
        // Verify the resume was saved by fetching the profile again
        const verifyProfile = await profilesApi.getByUsername(userData.username);
        const verifiedResumeUrl = verifyProfile.resume_url || verifyProfile.resumeUrl;
        
        if (!verifiedResumeUrl) {
          toast({
            title: "Warning",
            description: "Resume uploaded but may not be saved to profile. Please refresh the page.",
            variant: "destructive",
          });
        } else {
          // Update local state with verified URL
          setResumeUrl(verifiedResumeUrl);
          setResumeKey(verifyProfile.resume_key || response.key);
          
          // Notify Dashboard to refresh
          window.dispatchEvent(new CustomEvent('profileUpdated'));
        }
      } catch (updateError: unknown) {
        console.error("ResumePage: Failed to update profile with resume:", updateError);
        const message = updateError instanceof Error ? updateError.message : 'Unknown error';
        throw new Error(`Failed to save resume to profile: ${message}`);
      }

      // Note: setResumeUrl and setResumeKey will be called after verification above

      // Notify Dashboard to refresh
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (error: unknown) {
      console.error("Upload error:", error);
      const message = error instanceof Error ? error.message : "Failed to upload resume. Please try again.";
      toast({
        title: "Upload failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    try {
      const userData = await profilesApi.getCurrentUser();
      await profilesApi.createOrUpdate({
        username: userData.username,
        resume_url: "",
        resume_key: "",
      });

      setResumeUrl(null);
      setResumeKey(null);

      toast({
        title: "Resume removed",
        description: "Your resume has been removed.",
      });

      // Notify Dashboard to refresh
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (error: unknown) {
      console.error("Failed to remove resume:", error);
      toast({
        title: "Error",
        description: "Failed to remove resume. Please try again.",
        variant: "destructive",
      });
    }
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
        <h1 className="text-3xl font-bold">Resume</h1>
        <p className="text-muted-foreground mt-2">
          Upload your resume in PDF format. It will be publicly accessible on your profile.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resume Upload</CardTitle>
          <CardDescription>
            Upload a PDF version of your resume. Maximum file size is 10MB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {resumeUrl ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                <FileText className="h-12 w-12 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Resume uploaded</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {resumeUrl.split('/').pop() || 'resume.pdf'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(resumeUrl, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    View Full
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemove}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </div>
              
              {/* PDF Preview - shows top portion/header of resume */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Resume Preview</Label>
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="relative w-full max-w-2xl mx-auto h-96 bg-white rounded-lg overflow-hidden border-2 border-border hover:border-primary/50 transition-colors shadow-sm">
                    <iframe
                      src={`${resumeUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit&page=1`}
                      className="w-full h-full pointer-events-none"
                      title="Resume Preview"
                    />
                    {/* Gradient overlay at bottom to indicate more content */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40 pointer-events-none" />
                    {/* Overlay to make it clickable */}
                    <div className="absolute inset-0 bg-transparent group-hover:bg-black/5 transition-colors cursor-pointer" />
                  </div>
                  <p className="text-center text-sm text-muted-foreground mt-2">
                    Click preview to view full resume in new tab
                  </p>
                </a>
              </div>
              
              {/* Resume Visibility Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div className="space-y-0.5">
                  <Label htmlFor="show-resume" className="text-sm font-medium">
                    Show resume on public profile
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow visitors to view and download your resume
                  </p>
                </div>
                <Switch
                  id="show-resume"
                  checked={showResume}
                  onCheckedChange={async (checked) => {
                    setShowResume(checked);
                    try {
                      const userData = await profilesApi.getCurrentUser();
                      await profilesApi.createOrUpdate({
                        username: userData.username,
                        show_resume: checked,
                      });
                      toast({
                        title: "Visibility updated",
                        description: `Your resume is now ${checked ? 'visible' : 'hidden'} on your public profile.`,
                      });
                      window.dispatchEvent(new CustomEvent('profileUpdated'));
                    } catch (error: unknown) {
                      console.error("Failed to update resume visibility:", error);
                      toast({
                        title: "Error",
                        description: "Failed to update resume visibility. Please try again.",
                        variant: "destructive",
                      });
                      // Revert the toggle on error
                      setShowResume(!checked);
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium mb-2">No resume uploaded</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a PDF file to make it available on your profile
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Resume
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {!resumeUrl && (
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <FileText className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">File Requirements:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>PDF format only</li>
                  <li>Maximum file size: 10MB</li>
                  <li>Your resume will be publicly accessible</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResumePage;

