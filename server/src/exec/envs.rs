use std::path::PathBuf;
use crate::core::models::Task;
use anyhow::{Result, anyhow};
use serde::Deserialize;
use std::fs;

#[derive(Debug, Deserialize)]
struct KernelSpec {
    argv: Vec<String>,
    display_name: String,
    language: String,
}

pub fn build_command(task: &Task) -> Result<(String, Vec<String>)> {
    match task.env_type.as_str() {
        "shell" => {
            // Raw shell command
            // If command is "python script.py", we might want to run it directly if it's in path, or wrap in sh -c
            // For maximizing compatibility, let's use sh -c for "shell" type tasks so pipes work
            Ok(("sh".to_string(), vec!["-c".to_string(), task.command.clone()]))
        },
        "conda" | "mamba" | "micromamba" => {
            // conda run -n <env> <command>
            let binary = task.env_type.clone();
            let env_name = task.env_name.as_ref().ok_or_else(|| anyhow!("Environment name required for conda/mamba"))?;
            
            // "run", "-n", env_name, "--no-capture-output", command...
            // Note: --no-capture-output is important for pty interaction in some ver, 
            // but run typically execs.
            let mut args = vec![
                "run".to_string(),
                "-n".to_string(),
                env_name.clone(),
                "--no-capture-output".to_string(),
            ];
            
            // Split the user command? Or pass as remaining args?
            // "conda run ... python script.py"
            // If task.command is "python script.py", we need to split it or pass it properly.
            // conda run expects the executable and args.
            // Simple split by whitespace is dangerous.
            // For now, let's assume task.command is the binary and task.args (which we need to add to DB logic) are args.
            // BUT, my Task struct has `command: String` and `args: String`.
            
            // Let's rely on sh/bash to handle the inner command if it's complex
            // conda run -n myenv sh -c "complex command"
            args.push("sh".to_string());
            args.push("-c".to_string());
            args.push(task.command.clone());
            
            Ok((binary, args))
        },
        "uv" => {
             // uv run <command>
             // uv run --package <pkg> <command> ?
             // For now: uv run <command>
             let mut args = vec!["run".to_string()];
             // if task.env_name provided, maybe use it? UV is usually project local.
             // If cwd has pyproject.toml, uv run works.
             
             // Again, wrap in sh -c
             args.push("sh".to_string());
             args.push("-c".to_string());
             args.push(task.command.clone());
             
             Ok(("uv".to_string(), args))
        },
        "jupyter" => {
            // Parse kernel spec
            let kernel_path = task.env_name.as_ref().ok_or_else(|| anyhow!("Kernel path required"))?; // We store path in env_name for jupyter
            let content = fs::read_to_string(kernel_path)?;
            let spec: KernelSpec = serde_json::from_str(&content)?;
            
            if spec.argv.is_empty() {
                return Err(anyhow!("Empty argv in kernel spec"));
            }
            
            // argv[0] is the python executable usually
            // We want to run the user command using this executable/environment
            // Usually spec.argv look like ["/path/to/python", "-m", "ipykernel_launcher", "-f", "{connection_file}"]
            // We just want "/path/to/python" to run the user command.
            
            let python_bin = &spec.argv[0];
            
            // Run: /path/to/python -c "user command" ?? Or just /path/to/python script.py
            // Let's assume user command is "script.py" or "python script.py".
            // If it is "python script.py", we replace "python" with the absolute path.
            // Simpler: Just run `python_bin -c "command"` if it's a python code?
            // Or `python_bin script.py`?
            
            // Let's assume usage: /path/to/python <user_command_args>
            // But we wrap in sh -c? No, we have the specific python binary.
            
            // If task.command is "python train.py", we want "/path/to/env/python train.py".
            // Implementation: We can't easily parse "python train.py".
            // Strategy: We run `sh -c task.command` but with PATH modified?
            // OR: We expect task.command to be just "train.py" and we run `python_bin train.py`.
            
            // Robust approach: Run a shell, but activate the environment variables? 
            // Jupyter kernels don't always export env vars.
            
            // Fallback for now: Just use the first argv as the binary to run.
            // And pass task.command as arguments?
            // "python_bin" "-c" "task.command" (if it's code)
            // If user typed "train.py", they need to run "python train.py".
            
            // Let's try: `python_bin` run the command string as a script? No.
            
            // Compromise: We construct a command that uses the python binary from the kernel.
            // If user wrapper is "jupyter", we treat `task.command` as a script/module execution command.
            // e.g. "train.py --epochs 10"
            // We run: `python_bin train.py --epochs 10`
            
            // But what if they want `pip install`?
            
            // Best: Just extract the directory of python_bin, add to PATH, and run `sh -c command`.
            let bin_path = PathBuf::from(python_bin);
            let bin_dir = bin_path.parent().ok_or_else(|| anyhow!("Invalid python path"))?;
            
            // We can Return a special struct or modify the CommandBuilder in mod.rs to set env.
            // For this helper, let's return just the "sh -c ..." but we need a way to signal Env Vars.
            
            // Refactor `build_command` to return CommandBuilder? No, can't easily.
            // Let's return (pogram, args, env_overrides)
            // For now, simple:
            
            let mut args = vec!["-c".to_string(), task.command.clone()];
            // We'll rely on PREPENDING the bin_dir to PATH in the caller
            Ok(("sh".to_string(), args))
        },
        _ => Err(anyhow!("Unknown environment type")),
    }
}

pub fn get_env_vars(task: &Task) -> Result<Vec<(String, String)>> {
    match task.env_type.as_str() {
        "jupyter" => {
            if let Some(kernel_path) = &task.env_name {
                 let content = fs::read_to_string(kernel_path)?;
                 let spec: KernelSpec = serde_json::from_str(&content)?;
                 if !spec.argv.is_empty() {
                     let bin_path = PathBuf::from(&spec.argv[0]);
                     if let Some(bin_dir) = bin_path.parent() {
                         if let Ok(path_var) = std::env::var("PATH") {
                             return Ok(vec![("PATH".to_string(), format!("{}:{}", bin_dir.to_string_lossy(), path_var))]);
                         }
                     }
                 }
            }
            Ok(vec![])
        },
         _ => Ok(vec![]),
    }
}
