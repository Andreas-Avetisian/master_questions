#!/usr/bin/env perl

use strict;
use warnings;
use Cwd qw(abs_path);
use File::Spec;
use File::Temp qw(tempfile);

my $repo_root = shift // '.';
$repo_root = abs_path($repo_root);

my $vault_dir = File::Spec->catdir($repo_root, 'vault');
die "Vault directory not found: $vault_dir\n" unless -d $vault_dir;

my $docx_path = extract_docx($repo_root);
my $docx_text = extract_plain_text($docx_path);
my %metadata = parse_metadata($docx_text);

for my $qid (1 .. 72) {
    die "Missing metadata for question $qid\n" unless exists $metadata{$qid};
    my $note_path = File::Spec->catfile($vault_dir, "$qid.md");
    die "Missing note: $note_path\n" unless -f $note_path;
    update_note($note_path, $qid, $metadata{$qid});
}

sub extract_docx {
    my ($repo_root) = @_;

    my ($tmp_fh, $tmp_docx) = tempfile(SUFFIX => '.docx', UNLINK => 1);
    binmode $tmp_fh;

    open my $git_fh, '-|', 'git', '-C', $repo_root, 'show', 'origin/main:Exam_Study_Map_72_Questions.docx'
        or die "Failed to read docx from git history\n";
    binmode $git_fh;

    my $buffer;
    while (read($git_fh, $buffer, 8192)) {
        print {$tmp_fh} $buffer or die "Failed to write temporary docx\n";
    }

    close $git_fh or die "git show failed for Exam_Study_Map_72_Questions.docx\n";
    close $tmp_fh or die "Failed to close temporary docx\n";

    return $tmp_docx;
}

sub extract_plain_text {
    my ($docx_path) = @_;

    open my $pandoc_fh, '-|', 'pandoc', '-t', 'plain', $docx_path
        or die "Failed to run pandoc\n";
    local $/;
    my $text = <$pandoc_fh>;
    close $pandoc_fh or die "pandoc failed while extracting docx text\n";

    $text =~ s/\r\n?/\n/g;
    return $text;
}

sub parse_metadata {
    my ($text) = @_;
    my %metadata;

    while ($text =~ /Question\s+(\d+)\n\n(.*?)(?=\nQuestion\s+\d+\n\n|\nNotes on methodology:|\z)/sg) {
        my ($qid, $block) = ($1, $2);

        my ($course) = $block =~ /Course:\s*(.+?)\n\nSource file:/s;
        die "Missing course for question $qid\n" unless defined $course;

        my ($source_text) = $block =~ /Source file:\s*(.+?)\n\nQuote \/ key content:/s;
        die "Missing source file text for question $qid\n" unless defined $source_text;

        $course = normalize_whitespace($course);
        $source_text = normalize_whitespace($source_text);

        my @files = extract_source_files($source_text);

        die "No source files parsed for question $qid\n" unless @files;

        $metadata{$qid} = {
            course  => $course,
            sources => \@files,
        };
    }

    die "Expected metadata for 72 questions, found " . scalar(keys %metadata) . "\n"
        unless scalar(keys %metadata) == 72;

    return %metadata;
}

sub extract_source_files {
    my ($source_text) = @_;

    # Drop explanatory parentheses like "(MRI)" or "(historical timeline section)"
    # while keeping parentheses that themselves contain a file reference.
    $source_text =~ s{\(([^)]*)\)}{keep_or_strip_parenthetical($1)}ge;

    my @files;
    my %seen;

    while ($source_text =~ /([A-Za-z0-9][A-Za-z0-9_ .()\-+]*?\.(?:pdf|pptx|docx))/ig) {
        my $file = normalize_whitespace($1);
        $file =~ s/^\(+//;
        $file =~ s/\)+$//;
        $file =~ s/^(?:and|or)\s+//i;
        next if $seen{$file}++;
        push @files, $file;
    }

    return @files;
}

sub update_note {
    my ($note_path, $qid, $metadata) = @_;

    open my $in_fh, '<', $note_path or die "Failed to read $note_path\n";
    local $/;
    my $body = <$in_fh>;
    close $in_fh or die "Failed to close $note_path\n";

    $body =~ s/\A---\n.*?\n---\n+//s;

    my $frontmatter = build_frontmatter($qid, $metadata);

    open my $out_fh, '>', $note_path or die "Failed to write $note_path\n";
    print {$out_fh} $frontmatter . $body or die "Failed to update $note_path\n";
    close $out_fh or die "Failed to close updated note $note_path\n";
}

sub build_frontmatter {
    my ($qid, $metadata) = @_;

    my $frontmatter = "---\n";
    $frontmatter .= "qid: $qid\n";
    $frontmatter .= 'course: ' . yaml_quote($metadata->{course}) . "\n";
    $frontmatter .= "sources:\n";

    for my $file (@{$metadata->{sources}}) {
        $frontmatter .= '  - file: ' . yaml_quote($file) . "\n";
        $frontmatter .= '    pages: ""' . "\n";
    }

    $frontmatter .= "---\n\n";
    return $frontmatter;
}

sub normalize_whitespace {
    my ($value) = @_;
    $value =~ s/\s+/ /g;
    $value =~ s/^\s+//;
    $value =~ s/\s+$//;
    return $value;
}

sub keep_or_strip_parenthetical {
    my ($value) = @_;
    return $value =~ /\.(?:pdf|pptx|docx)/i ? "($value)" : '';
}

sub yaml_quote {
    my ($value) = @_;
    $value =~ s/'/''/g;
    return qq{'$value'};
}
